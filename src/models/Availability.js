const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  start: { type: String, required: true },   // "09:00"
  end: { type: String, required: true },      // "10:00"
  duration: { type: Number, required: true }, // in minutes
  course: { type: String, required: true },  // course code
  venue: { type: String, required: true, trim: true },
  maxStudents: { type: Number, required: true, default: 1 },
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
});

const dayScheduleSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  slots: [timeSlotSchema]
}, {_id: false});

const availabilitySchema = new mongoose.Schema({
  lecturerEmail: { type: String, required: true, unique: true },
  weeklySchedule: [dayScheduleSchema],
  courses: { type: [String], default: [] },   
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Availability', availabilitySchema);

