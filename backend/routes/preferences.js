// File: routes/preferences.js
const express = require('express');
const router = express.Router();
const UserPreference = require('../models/UserPreference');
const auth = require('../middleware/auth');
const ScheduleService = require('../services/ScheduleService');

// Get user preferences
router.get('/', auth, async (req, res) => {
  try {
    let preferences = await UserPreference.findOne({ userId: req.user.id });
    
    if (!preferences) {
      preferences = new UserPreference({ userId: req.user.id });
      await preferences.save();
    }
    
    res.json(preferences);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user preferences
router.patch('/', auth, async (req, res) => {
  try {
    let preferences = await UserPreference.findOne({ userId: req.user.id });
    
    if (!preferences) {
      preferences = new UserPreference({ 
        userId: req.user.id,
        ...req.body 
      });
    } else {
      Object.keys(req.body).forEach(key => {
        preferences[key] = req.body[key];
      });
    }
    
    const updatedPreferences = await preferences.save();
    
    // Recalculate schedule if mode changed
    if (req.body.schedulingMode) {
      const scheduleService = new ScheduleService(req.user.id);
      await scheduleService.recalculateSchedule();
    }
    
    res.json(updatedPreferences);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;

