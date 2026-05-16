// src/routes/bookings.js
const express = require('express')
const router = express.Router()
const Availability = require('../models/Availability')
const Booking = require('../models/booking')
const User = require('../models/user')
const Activity = require('../models/activity')

// Import your awesome middleware
const { validateLecturerHours } = require('../middleware/booking-validator')

function formatStudentDisplayName (student) {
  const firstName = student.name ? student.name.trim() : ''
  const surname = student.surname ? student.surname.trim() : ''
  const displayNameParts = (student.displayName || '').trim().split(/\s+/)
  const displayFirstName = displayNameParts.length > 1 ? displayNameParts[0] : ''
  const displaySurname = displayNameParts.length > 1 ? displayNameParts.slice(1).join(' ') : ''
  const resolvedFirstName = firstName || displayFirstName
  const resolvedSurname = surname || displaySurname
  const initial = resolvedFirstName ? `${resolvedFirstName.charAt(0).toUpperCase()}.` : ''
  const idNumber = student.idNumber ? `-${student.idNumber}` : ''
  const displayName = `${initial}${resolvedSurname}${idNumber}`
  return displayName || student.email
}

async function logBookingActivity (activity) {
  if (process.env.NODE_ENV === 'test') {
    return
  }

  try {
    await Activity.create({
      ...activity,
      timestamp: activity.timestamp || new Date()
    })
  } catch (error) {
    console.error('Failed to log booking activity:', error.message)
  }
}

function uniqueValues (values) {
  return [...new Set(values.filter(Boolean).map(String))]
}

function bookingActivityMetadata (booking, extra = {}) {
  const bookingObject = typeof booking.toObject === 'function' ? booking.toObject() : booking
  const participants = Array.isArray(bookingObject.participantIDs) ? bookingObject.participantIDs : []

  return {
    course: bookingObject.module,
    module: bookingObject.module,
    date: bookingObject.date,
    startTime: bookingObject.startTime,
    endTime: bookingObject.endTime,
    venue: bookingObject.venue,
    topic: bookingObject.topic,
    studentId: bookingObject.studentId,
    studentEmail: bookingObject.studentId,
    lecturerId: bookingObject.lecturerId,
    lecturerEmail: bookingObject.lecturerId,
    participantIDs: participants,
    participantEmails: participants,
    audienceIds: uniqueValues([bookingObject.studentId, bookingObject.lecturerId, ...participants]),
    audienceEmails: uniqueValues([bookingObject.studentId, bookingObject.lecturerId, ...participants]),
    ...extra
  }
}

// GET: Fetch all available courses and lecturers for the booking form
router.get('/form-data', async (req, res) => {
  try {
    // ADDED 'lecturerName' TO THE SELECT LIST BELOW
    const availabilities = await Availability.find({}, 'lecturerEmail lecturerName courses weeklySchedule')
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

async function createBooking (req, res) {
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
    await logBookingActivity({
      type: 'created',
      description: `Booked ${savedBooking.module || 'consultation'} consultation`,
      user: req.body.studentId,
      userId: req.body.studentId,
      userEmail: req.body.studentId,
      userRole: 'student',
      metadata: bookingActivityMetadata(savedBooking, {
        actorId: req.body.studentId,
        actorEmail: req.body.studentId,
        userRole: 'student'
      })
    })
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
// GET: Fetch ONLY the logged-in student's bookings (RESTORED GROUP LOGIC)
router.get('/', async (req, res) => {
  try {
    const { studentId } = req.query

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required.' })
    }

    const rawBookings = await Booking.find({
      $or: [
        { participantIDs: studentId },
        { leftParticipantIDs: studentId }
      ]
    }).sort({ date: 1, startTime: 1 }).lean()

    const lecturerIdentifiers = [...new Set(rawBookings.map(b => b.lecturerId).filter(Boolean))]

    // FIX: Search by both email AND idNumber since lecturerId contains the staff numeric ID
    const lecturers = lecturerIdentifiers.length
      ? await User.find({
        email: { $in: lecturerIdentifiers },
        role: 'lecturer'
      }, 'name surname email').lean()
      : []

    // Map names to both their email and idNumber for a bulletproof fallback lookup
    const lecturersByIdentifier = new Map()
    lecturers.forEach(lecturer => {
      const fullName = [lecturer.name, lecturer.surname].filter(Boolean).join(' ')
      if (lecturer.email) lecturersByIdentifier.set(lecturer.email, fullName)
    })

    // Dynamically override the status to 'canceled' on the user's side if they left
    const bookings = rawBookings.map(b => {
      const booking = {
        ...b,
        // FIX: Grab the mapped name using the identifier map
        lecturerName: lecturersByIdentifier.get(b.lecturerId) || b.lecturerId || 'Unknown Lecturer'
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

// DELETE: Cancel a booking (Now handles smart cancellation)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { studentEmail } = req.body

    // 1. Find the booking
    const booking = await Booking.findById(id)

    // 2. If it doesn't exist, return 404
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    if (!Array.isArray(booking.participantIDs)) {
      if (booking.studentId !== studentEmail) {
        return res.status(403).json({ success: false, message: 'Unauthorized to cancel this booking' })
      }

      await Booking.findByIdAndUpdate(id, { status: 'canceled' })
      await logBookingActivity({
        type: 'canceled',
        description: `Canceled ${booking.module || 'consultation'} booking`,
        user: studentEmail,
        userId: studentEmail,
        userEmail: studentEmail,
        userRole: 'student',
        metadata: bookingActivityMetadata(booking, {
          actorId: studentEmail,
          actorEmail: studentEmail,
          userRole: 'student'
        })
      })
      return res.status(200).json({ success: true, message: 'Booking successfully canceled' })
    }

    if (!booking.participantIDs.includes(studentEmail)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this booking' })
    }

    // 3. Remove this student from the participants array
    const updatedParticipants = booking.participantIDs.filter(email => email !== studentEmail)

    // 4. Check if the booking is now empty
    if (updatedParticipants.length === 0) {
      // No one left -> Cancel the booking completely
      await Booking.findByIdAndUpdate(id, {
        status: 'canceled',
        participantIDs: updatedParticipants,
        $addToSet: { leftParticipantIDs: studentEmail } // Optional: Keep track of who left
      })
      await logBookingActivity({
        type: 'canceled',
        description: `Canceled ${booking.module || 'consultation'} booking`,
        user: studentEmail,
        userId: studentEmail,
        userEmail: studentEmail,
        userRole: 'student',
        metadata: bookingActivityMetadata(booking, {
          actorId: studentEmail,
          actorEmail: studentEmail,
          userRole: 'student'
        })
      })
      return res.status(200).json({ success: true, message: 'Booking successfully canceled (no students remaining).' })
    }

    // 5. Others are still in the booking -> Just remove this student, keep it active
    await Booking.findByIdAndUpdate(id, {
      participantIDs: updatedParticipants,
      $addToSet: { leftParticipantIDs: studentEmail }
    })
    await logBookingActivity({
      type: 'canceled',
      description: `Left ${booking.module || 'consultation'} booking`,
      user: studentEmail,
      userId: studentEmail,
      userEmail: studentEmail,
      userRole: 'student',
      metadata: bookingActivityMetadata(booking, {
        actorId: studentEmail,
        actorEmail: studentEmail,
        userRole: 'student'
      })
    })

    res.status(200).json({ success: true, message: 'You have left the booking. It remains active for other students.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// LEAVE: Leave a booking (Using the exact same smart logic for consistency)
router.put('/leave/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { email } = req.body

    const booking = await Booking.findById(id)

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    const updatedParticipants = booking.participantIDs.filter(p => p !== email)

    // If the last joiner leaves, cancel the booking
    if (updatedParticipants.length === 0) {
      await Booking.findByIdAndUpdate(id, {
        status: 'canceled',
        participantIDs: updatedParticipants,
        $addToSet: { leftParticipantIDs: email }
      })
      await logBookingActivity({
        type: 'canceled',
        description: `Canceled ${booking.module || 'consultation'} session`,
        user: email,
        userId: email,
        userEmail: email,
        userRole: 'student',
        metadata: bookingActivityMetadata(booking, {
          actorId: email,
          actorEmail: email,
          userRole: 'student'
        })
      })
      return res.json({ success: true, message: 'Session canceled completely (no students remaining).' })
    }

    // Otherwise, just remove them
    await Booking.findByIdAndUpdate(id, {
      participantIDs: updatedParticipants,
      $addToSet: { leftParticipantIDs: email }
    })
    await logBookingActivity({
      type: 'canceled',
      description: `Left ${booking.module || 'consultation'} session`,
      user: email,
      userId: email,
      userEmail: email,
      userRole: 'student',
      metadata: bookingActivityMetadata(booking, {
        actorId: email,
        actorEmail: email,
        userRole: 'student'
      })
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

    const studentIdentifiers = [...new Set(bookings.flatMap(booking => [
      booking.studentId,
      ...(Array.isArray(booking.participantIDs) ? booking.participantIDs : [])
    ]).filter(Boolean))]

    const students = studentIdentifiers.length
      ? await User.find({
        $or: [
          { email: { $in: studentIdentifiers } },
          { idNumber: { $in: studentIdentifiers } }
        ]
      }, 'name surname displayName idNumber email').lean()
      : []
    const studentsByIdentifier = new Map()
    students.forEach(student => {
      const displayName = formatStudentDisplayName(student)
      if (student.email) studentsByIdentifier.set(student.email, displayName)
      if (student.idNumber) studentsByIdentifier.set(student.idNumber, displayName)
    })

    const enrichedBookings = bookings.map(booking => {
      const bookingObject = typeof booking.toObject === 'function' ? booking.toObject() : booking
      const participantNames = (bookingObject.participantIDs || [])
        .map(studentId => studentsByIdentifier.get(studentId) || studentId)

      return {
        ...bookingObject,
        studentName: studentsByIdentifier.get(bookingObject.studentId) || bookingObject.studentId,
        participantNames
      }
    })

    res.json(enrichedBookings)
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
