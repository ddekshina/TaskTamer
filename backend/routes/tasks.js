// File: routes/tasks.js
const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const ScheduleService = require('../services/ScheduleService');

// Get all tasks
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get one task
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a task
router.post('/', auth, async (req, res) => {
  const task = new Task({
    ...req.body,
    userId: req.user.id
  });

  try {
    const newTask = await task.save();
    
    // Trigger schedule recalculation
    const scheduleService = new ScheduleService(req.user.id);
    await scheduleService.recalculateSchedule();
    
    res.status(201).json(newTask);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update a task
router.patch('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Update task fields
    Object.keys(req.body).forEach(key => {
      task[key] = req.body[key];
    });
    
    const updatedTask = await task.save();
    
    // Recalculate schedule
    const scheduleService = new ScheduleService(req.user.id);
    await scheduleService.recalculateSchedule();
    
    res.json(updatedTask);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    await task.remove();
    
    // Recalculate schedule
    const scheduleService = new ScheduleService(req.user.id);
    await scheduleService.recalculateSchedule();
    
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

