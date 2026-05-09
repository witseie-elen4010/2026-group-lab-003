const mongoose = require('mongoose')

const bookingSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true
  },
  lecturerId: {
    type: String,
    required: true
  },
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
