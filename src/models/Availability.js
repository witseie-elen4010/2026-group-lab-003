const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  start: { type: String, required: true },   // "09:00"
  end: { type: String, required: true }      // "17:00"
});

const dayScheduleSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  slots: [timeSlotSchema]
});

const availabilitySchema = new mongoose.Schema({
  lecturerEmail: { type: String, required: true, unique: true },
  defaultDuration: { type: Number, required: true, default: 30 },
  weeklySchedule: [dayScheduleSchema],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Availability', availabilitySchema);