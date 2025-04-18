// File: routes/schedule.js
const express = require('express');
const router = express.Router();
const TimeSlot = require('../models/TimeSlot');
const auth = require('../middleware/auth');
const ScheduleService = require('../services/ScheduleService');

// Get schedule for a date range
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start and end dates are required' });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const timeSlots = await TimeSlot.find({
      userId: req.user.id,
      startTime: { $gte: start },
      endTime: { $lte: end }
    }).populate('taskId');
    
    res.json(timeSlots);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Force schedule recalculation
router.post('/recalculate', auth, async (req, res) => {
  try {
    const scheduleService = new ScheduleService(req.user.id);
    const result = await scheduleService.recalculateSchedule();
    
    res.json({
      message: 'Schedule recalculated successfully',
      conflicts: result.conflicts
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark a time slot as completed
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const timeSlot = await TimeSlot.findOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!timeSlot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }
    
    timeSlot.status = 'completed';
    await timeSlot.save();
    
    res.json(timeSlot);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;