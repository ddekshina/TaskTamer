// File: models/RoutineBlock.js
const mongoose = require('mongoose');

const RoutineBlockSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  startTime: {
    type: String, // "HH:MM" format
    required: true
  },
  endTime: {
    type: String, // "HH:MM" format
    required: true
  },
  daysOfWeek: {
    type: [Number], // 0 = Sunday, 1 = Monday, etc.
    required: true,
    validate: {
      validator: function(arr) {
        return arr.every(day => day >= 0 && day <= 6);
      },
      message: 'Days must be between 0 (Sunday) and 6 (Saturday)'
    }
  },
  isRecurring: {
    type: Boolean,
    default: true
  },
  specificDate: {
    type: Date,
    required: function() {
      return !this.isRecurring;
    }
  },
  type: {
    type: String,
    enum: ['work', 'class', 'personal', 'other'],
    default: 'other'
  }
});

module.exports = mongoose.model('RoutineBlock', RoutineBlockSchema);

