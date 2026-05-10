// src/routes/bookings.js
const express = require('express')
const router = express.Router()

// Import your awesome middleware from the previous step
const { validateLecturerHours } = require('../middleware/booking-validator')

// Create the POST route using your middleware
router.post('/create', validateLecturerHours, async (req, res) => {
  try {
    const newBooking = new Booking({
      studentId: req.body.studentId,
      lecturerId: req.body.lecturerId,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      module: req.body.module,
      topic: req.body.topic,
      status: 'upcoming'
    })

    const savedBooking = await newBooking.save()
    res.status(201).json({ success: true, message: 'Booking successful!', booking: savedBooking || newBooking })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to create booking' })
  }
})

// routes/bookings.js
const Availability = require('../models/Availability')
const Booking = require('../models/booking')

// GET: Check available slots
router.get('/availability', async (req, res) => {
  try {
    const { lecturerId, date } = req.query
    const dateObj = new Date(date)
    const dayOfWeek = dateObj.getDay()

    const availability = await Availability.findOne({ lecturerEmail: lecturerId })

    if (!availability) {
      return res.status(404).json({ error: 'Lecturer availability not found.' })
    }

    const daySchedule = availability.weeklySchedule.find(d => d.dayOfWeek === dayOfWeek)

    if (!daySchedule || daySchedule.slots.length === 0) {
      return res.json({ message: 'Lecturer is not available on this day.', slots: [], booked: [] })
    }

    const existingBookings = await Booking.find({
      lecturerId,
      date,
      status: { $ne: 'canceled' }
    })
    const bookedTimes = existingBookings.map(b => b.startTime)

    res.json({
      duration: availability.defaultDuration,
      availableBlocks: daySchedule.slots,
      bookedTimes
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error checking availability.' })
  }
})

// POST: Save a new booking
router.post('/', async (req, res) => {
  try {
    // Create the booking, ensuring studentId is included
    const newBooking = new Booking({
      studentId: req.body.studentId,
      lecturerId: req.body.lecturerId,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      module: req.body.module,
      topic: req.body.topic,
      status: 'upcoming',
      participantIDs: [req.body.studentId],
      leftParticipantIDs: []
    })

    const savedBooking = await newBooking.save()
    res.status(201).json({ message: 'Booking successful!', booking: savedBooking })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to create booking' })
  }
})

// Fetch ONLY the logged-in student's bookings
router.get('/', async (req, res) => {
  try {
    const { studentId } = req.query

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required.' })
    }

    // Fetch bookings where the student is currently active OR where they previously left
    const rawBookings = await Booking.find({
      $or: [
        { participantIDs: studentId },
        { leftParticipantIDs: studentId }
      ]
    }).sort({ date: 1, startTime: 1 }).lean()

    // Dynamically override the status to 'canceled' on the user's side if they left
    const bookings = rawBookings.map(b => {
      if (b.leftParticipantIDs && b.leftParticipantIDs.includes(studentId)) {
        return { ...b, status: 'canceled' }
      }
      return b
    })

    res.json(bookings)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch bookings' })
  }
})

// DELETE: Cancel a booking (ORGANIZER ONLY)
router.delete('/:id', async (req, res) => {
  try {
    // 1. Check the booking exists
    const booking = await Booking.findById(req.params.id)

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    // 2. Authorization: only the student who made the booking can cancel it
    if (booking.studentId !== req.body.studentEmail) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only cancel your own bookings.' })
    }

    // 3. Soft delete — update status to 'canceled'
    await Booking.findByIdAndUpdate(req.params.id, { status: 'canceled' })
    res.json({ success: true, message: 'Booking successfully canceled' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to cancel booking' })
  }
})

// LEAVE: Leave a booking (Joiners only)
router.put('/leave/:id', async (req, res) => {
  try {
    const { email } = req.body
    const booking = await Booking.findById(req.params.id)

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    // Reduces participant count by pulling from participantIDs, and records the leave
    await Booking.findByIdAndUpdate(req.params.id, {
      $pull: { participantIDs: email },
      $addToSet: { leftParticipantIDs: email }
    })

    res.json({ success: true, message: 'Successfully left the session.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to leave session' })
  }
})

module.exports = router
