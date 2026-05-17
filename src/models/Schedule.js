const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  start: { type: String, required: true },
  end: { type: String, required: true }
}, { _id: false });

const dayScheduleSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true, min: 1, max: 5 },
  slots: [timeSlotSchema]
}, { _id: false });

const scheduleSchema = new mongoose.Schema({
  lecturerId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  lecturerName: {
    type: String,
    required: true,
    trim: true
  },
  staffId: {
    type: String,
    required: true,
    trim: true
  },
  slotCapacity: { type: Number, default: 1 },
  dailySessionLimit: { type: Number, default: 10 },
  courses: [{ type: String, trim: true }],
  weeklySchedule: [dayScheduleSchema],
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'schedules'
});

module.exports = mongoose.model('Schedule', scheduleSchema);
