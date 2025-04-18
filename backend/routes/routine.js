// File: routes/routine.js
const express = require('express');
const router = express.Router();
const RoutineBlock = require('../models/RoutineBlock');
const auth = require('../middleware/auth');
const ScheduleService = require('../services/ScheduleService');

// Get all routine blocks
router.get('/', auth, async (req, res) => {
  try {
    const routines = await RoutineBlock.find({ userId: req.user.id });
    res.json(routines);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a routine block
router.post('/', auth, async (req, res) => {
  const routineBlock = new RoutineBlock({
    ...req.body,
    userId: req.user.id
  });

  try {
    const newRoutine = await routineBlock.save();
    
    // Recalculate schedule
    const scheduleService = new ScheduleService(req.user.id);
    await scheduleService.recalculateSchedule();
    
    res.status(201).json(newRoutine);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update a routine block
router.patch('/:id', auth, async (req, res) => {
  try {
    const routine = await RoutineBlock.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });
    
    if (!routine) {
      return res.status(404).json({ message: 'Routine block not found' });
    }
    
    Object.keys(req.body).forEach(key => {
      routine[key] = req.body[key];
    });
    
    const updatedRoutine = await routine.save();
    
    // Recalculate schedule
    const scheduleService = new ScheduleService(req.user.id);
    await scheduleService.recalculateSchedule();
    
    res.json(updatedRoutine);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a routine block
router.delete('/:id', auth, async (req, res) => {
  try {
    const routine = await RoutineBlock.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });
    
    if (!routine) {
      return res.status(404).json({ message: 'Routine block not found' });
    }
    
    await routine.remove();
    
    // Recalculate schedule
    const scheduleService = new ScheduleService(req.user.id);
    await scheduleService.recalculateSchedule();
    
    res.json({ message: 'Routine block deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

