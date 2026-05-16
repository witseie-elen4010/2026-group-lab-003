// src/routes/bookings.js
const express = require('express')
const router = express.Router()
const Availability = require('../models/Availability')
const Booking = require('../models/booking')
const User = require('../models/user')

// Import your awesome middleware
const { validateLecturerHours } = require('../middleware/booking-validator')

// GET: Fetch all available courses and lecturers for the booking form
router.get('/form-data', async (req, res) => {
  try {
    const availabilities = await Availability.find({}, 'lecturerEmail courses weeklySchedule')
    res.json(availabilities)
  } catch (error) {
    console.error('Error fetching form data:', error)
    res.status(500).json({ error: 'Failed to fetch form data' })
  }
})

// GET: Check available slots
router.get('/availability', async (req, res) => {
  try {
    const { lecturerId, date } = req.query
    const dateObj = new Date(date)
    const dayOfWeek = dateObj.getDay()

    const schedule = await Availability.findOne({ lecturerEmail: lecturerId })

    if (!schedule) {
      return res.status(404).json({ error: 'Lecturer availability not found.' })
    }

    const daySchedule = schedule.weeklySchedule.find(d => d.dayOfWeek === dayOfWeek)

    if (!daySchedule || daySchedule.slots.length === 0) {
      return res.json({ message: 'Lecturer is not available on this day.', availableBlocks: [], bookedTimes: [] })
    }

    const existingBookings = await Booking.find({
      lecturerId,
      date,
      status: { $ne: 'canceled' }
    })

    const bookedTimes = existingBookings.map(b => b.startTime)

    res.json({
      availableBlocks: daySchedule.slots,
      bookedTimes
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error checking availability.' })
  }
})

async function createBooking(req, res) {
  try {
    if (!req.body.topic || !req.body.topic.trim()) {
      return res.status(400).json({ success: false, message: 'Topic is required' })
    }

    const newBooking = new Booking({
      studentId: req.body.studentId,
      lecturerId: req.body.lecturerId,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      module: req.body.module,
      venue: req.body.venue || '',
      topic: req.body.topic.trim(),
      status: 'upcoming',
      participantIDs: [req.body.studentId], // CRITICAL for your "leave" feature
      leftParticipantIDs: []
    })

    const savedBooking = await newBooking.save()
    res.status(201).json({ message: 'Booking successful!', booking: savedBooking })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to create booking' })
  }
}

// POST: Save a new booking (MERGED AND FIXED!)
// Notice how it uses your middleware AND saves the data properly now
router.post('/', validateLecturerHours, createBooking)
router.post('/create', validateLecturerHours, createBooking)

// PUT: Cancel every booking that belongs to the same grouped lecturer session
router.put('/session/cancel', async (req, res) => {
  try {
    const { bookingIds } = req.body

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ success: false, message: 'bookingIds are required' })
    }

    const result = await Booking.updateMany(
      { _id: { $in: bookingIds } },
      { $set: { status: 'canceled' } }
    )

    res.json({
      success: true,
      message: 'Session canceled for all participants',
      modifiedCount: result.modifiedCount || 0
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Failed to cancel session' })
  }
})

// GET: Fetch ONLY the logged-in student's bookings (RESTORED GROUP LOGIC)
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

    const lecturerEmails = [...new Set(rawBookings.map(b => b.lecturerId).filter(Boolean))]
    const lecturers = lecturerEmails.length
      ? await User.find({ email: { $in: lecturerEmails }, role: 'lecturer' }, 'name surname email').lean()
      : []
    const lecturersByEmail = new Map(lecturers.map(lecturer => [
      lecturer.email,
      [lecturer.name, lecturer.surname].filter(Boolean).join(' ')
    ]))

    // Dynamically override the status to 'canceled' on the user's side if they left
    const bookings = rawBookings.map(b => {
      const booking = {
        ...b,
        lecturerName: lecturersByEmail.get(b.lecturerId) || b.lecturerId || 'Unknown Lecturer'
      }

      if (b.leftParticipantIDs && b.leftParticipantIDs.includes(studentId)) {
        return { ...booking, status: 'canceled' }
      }
      return booking
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
    const { id } = req.params
    const { studentEmail } = req.body // The test sends { studentEmail: '...' }

    // 1. Find the booking first
    const booking = await Booking.findById(id)

    // 2. If it doesn't exist, return 404
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    // 3. If the person deleting it isn't the owner, return 403 Unauthorized
    if (booking.studentId !== studentEmail) {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this booking' })
    }

    // 4. If it passes all checks, go ahead and cancel it!
    await Booking.findByIdAndUpdate(id, { status: 'canceled' })

    res.status(200).json({ success: true, message: 'Booking successfully canceled' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Server error' })
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

// LEAVE: Leave a booking (Joiners only)
router.put('/leave/:id', async (req, res) => {
  try {
    const { email } = req.body
    const booking = await Booking.findById(req.params.id)

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

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

// GET /api/lecturer/bookings?email=lecturer_1
router.get('/lecturer/bookings', async (req, res) => {
  try {
    const { email } = req.query
    const bookings = await Booking.find({
      lecturerId: email
    }).sort({ date: 1, startTime: 1 })

    res.json(bookings)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/lecturer/availability?email=lecturer_1
router.get('/lecturer/availability', async (req, res) => {
  try {
    const availability = await Availability.findOne({ lecturerEmail: req.query.email })
    res.json(availability)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT: Update booking status (for dashboard cancel/complete)
router.put('/:id', async (req, res) => {
  try {
    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    )
    if (!updated) {
      return res.status(404).json({ error: 'Booking not found' })
    }
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to update booking' })
  }
})

module.exports = router
