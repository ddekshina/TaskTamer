// File: services/ScheduleService.js
const Task = require('../models/Task');
const RoutineBlock = require('../models/RoutineBlock');
const TimeSlot = require('../models/TimeSlot');
const UserPreference = require('../models/UserPreference');

class ScheduleService {
  constructor(userId) {
    this.userId = userId;
    this.preferences = null;
    this.tasks = [];
    this.routines = [];
    this.timeSlots = [];
    this.availableSlots = [];
    this.conflicts = [];
  }

  // Main function to recalculate the entire schedule
  async recalculateSchedule() {
    try {
      await this.loadData();
      await this.clearFutureSchedule();
      this.calculateAvailableTimeSlots();
      
      if (this.preferences.schedulingMode === 'fast') {
        await this.allocateTasksFastMode();
      } else {
        await this.allocateTasksSpreadMode();
      }
      
      return { 
        success: true,
        conflicts: this.conflicts
      };
    } catch (error) {
      console.error('Schedule recalculation failed:', error);
      throw error;
    }
  }

  // Load all required data
  async loadData() {
    // Load user preferences
    this.preferences = await UserPreference.findOne({ userId: this.userId });
    if (!this.preferences) {
      this.preferences = new UserPreference({ userId: this.userId });
      await this.preferences.save();
    }

    // Load incomplete tasks
    this.tasks = await Task.find({ 
      userId: this.userId,
      status: { $ne: 'completed' }
    }).sort({ deadline: 1 });

    // Load routine blocks
    this.routines = await RoutineBlock.find({ userId: this.userId });

    // Load existing time slots that are completed or in progress
    this.timeSlots = await TimeSlot.find({
      userId: this.userId,
      status: { $in: ['completed', 'in_progress'] }
    });
  }

  // Clear future scheduled time slots
  async clearFutureSchedule() {
    const now = new Date();
    await TimeSlot.deleteMany({
      userId: this.userId,
      startTime: { $gt: now },
      status: 'scheduled'
    });
  }

  // Calculate available time slots based on working hours and routine blocks
  calculateAvailableTimeSlots() {
    const now = new Date();
    const endDate = this.calculateScheduleEndDate();
    
    this.availableSlots = [];
    
    // For each day from now to the furthest deadline
    let currentDate = new Date(now);
    currentDate.setHours(0, 0, 0, 0);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      // Skip if not a work day
      if (!this.preferences.workDays.includes(dayOfWeek)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Get working hours for the day
      const workStart = this.timeStringToMinutes(this.preferences.workingHours.start);
      const workEnd = this.timeStringToMinutes(this.preferences.workingHours.end);
      
      // Create a day's worth of available time
      let daySlots = [{
        start: workStart,
        end: workEnd,
        date: new Date(currentDate)
      }];
      
      // Remove routine blocks for this day
      this.routines.forEach(routine => {
        if (routine.isRecurring) {
          // Check if routine applies to this day of week
          if (routine.daysOfWeek.includes(dayOfWeek)) {
            daySlots = this.removeTimeBlockFromSlots(
              daySlots,
              this.timeStringToMinutes(routine.startTime),
              this.timeStringToMinutes(routine.endTime)
            );
          }
        } else if (
          routine.specificDate.getDate() === currentDate.getDate() &&
          routine.specificDate.getMonth() === currentDate.getMonth() &&
          routine.specificDate.getFullYear() === currentDate.getFullYear()
        ) {
          // One-time routine on this specific date
          daySlots = this.removeTimeBlockFromSlots(
            daySlots,
            this.timeStringToMinutes(routine.startTime),
            this.timeStringToMinutes(routine.endTime)
          );
        }
      });
      
      // Remove already scheduled slots (completed or in-progress)
      this.timeSlots.forEach(slot => {
        const slotDate = new Date(slot.startTime);
        if (
          slotDate.getDate() === currentDate.getDate() &&
          slotDate.getMonth() === currentDate.getMonth() &&
          slotDate.getFullYear() === currentDate.getFullYear()
        ) {
          const slotStart = slotDate.getHours() * 60 + slotDate.getMinutes();
          const slotEnd = new Date(slot.endTime).getHours() * 60 + new Date(slot.endTime).getMinutes();
          
          daySlots = this.removeTimeBlockFromSlots(daySlots, slotStart, slotEnd);
        }
      });
      
      // Filter out slots that are too small for minimum work session
      daySlots = daySlots.filter(slot => 
        (slot.end - slot.start) >= this.preferences.breakDuration
      );
      
      // Add valid slots to the available slots
      this.availableSlots = [...this.availableSlots, ...daySlots];
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Fast Mode: Allocate tasks as early as possible
  async allocateTasksFastMode() {
    // Sort tasks by deadline, then priority
    const sortedTasks = [...this.tasks].sort((a, b) => {
      if (a.deadline.getTime() !== b.deadline.getTime()) {
        return a.deadline.getTime() - b.deadline.getTime();
      }
      
      const priorityValues = { high: 0, medium: 1, low: 2 };
      return priorityValues[a.priority] - priorityValues[b.priority];
    });
    
    // Process each task
    for (const task of sortedTasks) {
      if (task.status === 'completed') continue;
      
      const slotsNeeded = await this.scheduleTask(task, false);
      
      if (slotsNeeded === 0) {
        this.conflicts.push({
          taskId: task._id,
          message: `Could not schedule task "${task.title}" before its deadline`
        });
      }
    }
    
    return true;
  }

  // Spread Mode: Distribute tasks evenly to meet deadlines
  async allocateTasksSpreadMode() {
    // First, handle tasks with dependencies
    const tasksWithDependencies = this.tasks.filter(task => 
      task.dependencies && task.dependencies.length > 0
    );
    
    // Schedule dependent tasks first (recursively)
    for (const task of tasksWithDependencies) {
      await this.scheduleTaskWithDependencies(task);
    }
    
    // Handle remaining tasks
    const remainingTasks = this.tasks.filter(task => 
      !tasksWithDependencies.some(t => t._id.equals(task._id))
    );
    
    // Group tasks by deadline
    const tasksByDeadline = {};
    remainingTasks.forEach(task => {
      const dateKey = task.deadline.toDateString();
      if (!tasksByDeadline[dateKey]) {
        tasksByDeadline[dateKey] = [];
      }
      tasksByDeadline[dateKey].push(task);
    });
    
    // Process each deadline group
    for (const dateKey in tasksByDeadline) {
      const deadlineTasks = tasksByDeadline[dateKey];
      const deadlineDate = new Date(dateKey);
      
      // Sort by priority within deadline
      deadlineTasks.sort((a, b) => {
        const priorityValues = { high: 0, medium: 1, low: 2 };
        return priorityValues[a.priority] - priorityValues[b.priority];
      });
      
      // Calculate available days until deadline
      const now = new Date();
      const availableDays = this.calculateWorkDaysBetweenDates(now, deadlineDate);
      
      // Distribute tasks across available days
      for (const task of deadlineTasks) {
        if (task.status === 'completed') continue;
        
        const slotsNeeded = await this.scheduleTask(task, true, availableDays);
        
        if (slotsNeeded === 0) {
          this.conflicts.push({
            taskId: task._id,
            message: `Could not schedule task "${task.title}" before its deadline`
          });
        }
      }
    }
    
    return true;
  }

  // Schedule a single task
  async scheduleTask(task, spreadMode = false, availableDays = 1) {
    // Determine how many slots needed for this task
    const minWorkSession = task.minWorkSession || 30; // minutes
    
    let slotsNeeded = 1; // Start with at least one session
    let slotsScheduled = 0;
    
    // Find available slots for this task before its deadline
    const eligibleSlots = this.availableSlots.filter(slot => {
      const slotDate = new Date(slot.date);
      slotDate.setHours(Math.floor(slot.start / 60), slot.start % 60);
      return slotDate < task.deadline;
    });
    
    if (eligibleSlots.length === 0) {
      return 0; // No slots available before deadline
    }
    
    // Fast mode: use earliest slots
    if (!spreadMode) {
      for (const slot of eligibleSlots) {
        if (slot.end - slot.start >= minWorkSession) {
          await this.createTimeSlot(task, slot, minWorkSession);
          
          // Remove used slot from available slots
          this.removeTimeBlockFromAvailableSlots(
            slot.date,
            slot.start,
            slot.start + minWorkSession
          );
          
          slotsScheduled++;
          if (slotsScheduled >= slotsNeeded) {
            break;
          }
        }
      }
    } 
    // Spread mode: distribute evenly across available days
    else {      
      // Attempt to distribute task sessions evenly
      const targetSlotsPerDay = Math.ceil(slotsNeeded / availableDays);
      
      // Group slots by date
      const slotsByDate = {};
      eligibleSlots.forEach(slot => {
        const dateKey = slot.date.toDateString();
        if (!slotsByDate[dateKey]) {
          slotsByDate[dateKey] = [];
        }
        slotsByDate[dateKey].push(slot);
      });
      
      // Try to schedule the target number of slots on each available day
      for (const dateKey in slotsByDate) {
        const daySlots = slotsByDate[dateKey];
        let dailySlotsScheduled = 0;
        
        for (const slot of daySlots) {
          if (slot.end - slot.start >= minWorkSession && dailySlotsScheduled < targetSlotsPerDay) {
            await this.createTimeSlot(task, slot, minWorkSession);
            
            // Remove used slot from available slots
            this.removeTimeBlockFromAvailableSlots(
              slot.date,
              slot.start,
              slot.start + minWorkSession
            );
            
            slotsScheduled++;
            dailySlotsScheduled++;
            
            if (slotsScheduled >= slotsNeeded) {
              break;
            }
          }
        }
      }
      
      // If we couldn't distribute evenly, use any remaining slots
      if (slotsScheduled < slotsNeeded) {
        for (const slot of eligibleSlots) {
          if (slot.end - slot.start >= minWorkSession) {
            // Check if this slot has been used already
            const slotInUse = this.isSlotInUse(slot.date, slot.start, slot.start + minWorkSession);
            
            if (!slotInUse) {
              await this.createTimeSlot(task, slot, minWorkSession);
              
              // Remove used slot from available slots
              this.removeTimeBlockFromAvailableSlots(
                slot.date,
                slot.start,
                slot.start + minWorkSession
              );
              
              slotsScheduled++;
              if (slotsScheduled >= slotsNeeded) {
                break;
              }
            }
          }
        }
      }
    }
    
    return slotsScheduled;
  }

  // Schedule a task with dependencies
  async scheduleTaskWithDependencies(task, processedTasks = new Set()) {
    // Prevent circular dependencies
    if (processedTasks.has(task._id.toString())) {
      return;
    }
    
    processedTasks.add(task._id.toString());
    
    // First, schedule all dependencies
    for (const depId of task.dependencies) {
      const depTask = this.tasks.find(t => t._id.equals(depId));
      
      if (depTask) {
        await this.scheduleTaskWithDependencies(depTask, processedTasks);
      }
    }
    
    // Now schedule this task based on mode
    if (this.preferences.schedulingMode === 'fast') {
      await this.scheduleTask(task, false);
    } else {
      const now = new Date();
      const availableDays = this.calculateWorkDaysBetweenDates(now, task.deadline);
      await this.scheduleTask(task, true, availableDays);
    }
  }

  // Helper: Create a time slot in the database
  async createTimeSlot(task, slot, duration) {
    const slotDate = new Date(slot.date);
    
    const startTime = new Date(slotDate);
    startTime.setHours(Math.floor(slot.start / 60), slot.start % 60);
    
    const endTime = new Date(slotDate);
    endTime.setHours(Math.floor((slot.start + duration) / 60), (slot.start + duration) % 60);
    
    const timeSlot = new TimeSlot({
      userId: this.userId,
      taskId: task._id,
      startTime,
      endTime,
      status: 'scheduled',
      isFixed: false
    });
    
    await timeSlot.save();
    this.timeSlots.push(timeSlot);
    
    return timeSlot;
  }

  // Helper: Calculate furthest deadline date
  calculateScheduleEndDate() {
    if (this.tasks.length === 0) {
      // If no tasks, schedule 2 weeks out
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);
      return endDate;
    }
    
    // Find furthest deadline
    return this.tasks.reduce((latest, task) => {
      return task.deadline > latest ? task.deadline : latest;
    }, new Date());
  }

  // Helper: Convert time string to minutes since midnight
  timeStringToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Helper: Remove a time block from slots
  // Helper: Remove a time block from slots
  removeTimeBlockFromSlots(slots, blockStart, blockEnd) {
    const newSlots = [];
    
    slots.forEach(slot => {
      // Case 1: Block is completely outside slot
      if (blockEnd <= slot.start || blockStart >= slot.end) {
        newSlots.push(slot);
      }
      // Case 2: Block completely overlaps slot
      else if (blockStart <= slot.start && blockEnd >= slot.end) {
        // Slot is completely blocked, so skip it
      }
      // Case 3: Block starts before slot but ends inside
      else if (blockStart <= slot.start && blockEnd > slot.start && blockEnd < slot.end) {
        newSlots.push({
          start: blockEnd,
          end: slot.end,
          date: slot.date
        });
      }
      // Case 4: Block starts inside slot and ends after slot
      else if (blockStart > slot.start && blockStart < slot.end && blockEnd >= slot.end) {
        newSlots.push({
          start: slot.start,
          end: blockStart,
          date: slot.date
        });
      }
      // Case 5: Block is completely inside slot
      else if (blockStart > slot.start && blockEnd < slot.end) {
        newSlots.push({
          start: slot.start,
          end: blockStart,
          date: slot.date
        });
        newSlots.push({
          start: blockEnd,
          end: slot.end,
          date: slot.date
        });
      }
    });
    
    return newSlots;
  }

  // Helper: Remove a time block from available slots
  removeTimeBlockFromAvailableSlots(date, blockStart, blockEnd) {
    const dateString = date.toDateString();
    
    this.availableSlots = this.availableSlots.filter(slot => {
      // Skip if not the same date
      if (slot.date.toDateString() !== dateString) return true;
      
      // Check if slot is entirely within the block
      if (slot.start >= blockStart && slot.end <= blockEnd) {
        return false;
      }
      
      return true;
    });
    
    // Update slots that overlap with the block
    const overlappingSlots = this.availableSlots.filter(slot => {
      if (slot.date.toDateString() !== dateString) return false;
      
      return (
        (slot.start < blockStart && slot.end > blockStart) ||
        (slot.start < blockEnd && slot.end > blockEnd) ||
        (slot.start < blockStart && slot.end > blockEnd)
      );
    });
    
    // Remove overlapping slots
    this.availableSlots = this.availableSlots.filter(slot => 
      !overlappingSlots.some(os => 
        os.date.toDateString() === slot.date.toDateString() && 
        os.start === slot.start && 
        os.end === slot.end
      )
    );
    
    // Add back modified slots
    overlappingSlots.forEach(slot => {
      const newSlots = this.removeTimeBlockFromSlots([slot], blockStart, blockEnd);
      this.availableSlots = [...this.availableSlots, ...newSlots];
    });
  }

  // Helper: Check if a slot is already in use
  isSlotInUse(date, start, end) {
    const dateString = date.toDateString();
    
    return !this.availableSlots.some(slot => 
      slot.date.toDateString() === dateString &&
      slot.start <= start &&
      slot.end >= end
    );
  }

  // Helper: Calculate work days between two dates
  calculateWorkDaysBetweenDates(startDate, endDate) {
    let count = 0;
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    
    const endDateNormalized = new Date(endDate);
    endDateNormalized.setHours(0, 0, 0, 0);
    
    while (currentDate <= endDateNormalized) {
      const dayOfWeek = currentDate.getDay();
      if (this.preferences.workDays.includes(dayOfWeek)) {
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return Math.max(1, count); // Ensure at least 1 day
  }
}

module.exports = ScheduleService;