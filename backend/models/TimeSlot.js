// File: models/TimeSlot.js
const mongoose = require('mongoose');

const TimeSlotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'rescheduled'],
    default: 'scheduled'
  },
  isFixed: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('TimeSlot', TimeSlotSchema);

