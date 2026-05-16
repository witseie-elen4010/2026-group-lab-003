const mongoose = require('mongoose')

const bookingSchema = new mongoose.Schema({
  studentId: { // Student who created the booking
    type: String,
    required: true
  },
  lecturerId: {
    type: String,
    required: true
  },
  participantIDs: [{ type: String }], // List of everyone (including organizer)
  leftParticipantIDs: [{ type: String }], // Attendees who left
  date: {
    type: String,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: true,
    trim: true
  },
  venue: {
    type: String,
    default: '',
    trim: true
  },
  topic: {
    type: String,
    default: '',
    trim: true
  },
  maxStudents: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    default: 'upcoming'
  }
})

const Booking = mongoose.model('Booking', bookingSchema)
module.exports = Booking
