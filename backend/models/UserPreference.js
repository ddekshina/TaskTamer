// File: models/UserPreference.js
const mongoose = require('mongoose');

const UserPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  workingHours: {
    start: {
      type: String, // "HH:MM" format
      default: "09:00"
    },
    end: {
      type: String, // "HH:MM" format
      default: "17:00"
    }
  },
  breakDuration: {
    type: Number, // minutes
    default: 15
  },
  bufferTime: {
    type: Number, // minutes between scheduled tasks
    default: 10
  },
  schedulingMode: {
    type: String,
    enum: ['fast', 'spread'],
    default: 'spread'
  },
  workDays: {
    type: [Number], // 0 = Sunday, 1 = Monday, etc.
    default: [1, 2, 3, 4, 5] // Mon-Fri
  }
});

module.exports = mongoose.model('UserPreference', UserPreferenceSchema);