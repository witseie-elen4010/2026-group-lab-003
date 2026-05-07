// src/routes/bookings.js
const express = require('express')
const router = express.Router()

// Import your awesome middleware from the previous step
const { validateLecturerHours } = require('../middleware/booking-validator')

// Create the POST route using your middleware
router.post('/create', validateLecturerHours, (req, res) => {
  // This is the PLACEHOLDER function.
  // If the middleware lets the request through, this runs.

  // To-Do for Teammate: Replace this response with actual Database saving logic
  res.status(200).json({
    success: true,
    message: 'Validation passed! Booking is ready to be saved to the database.'
  })
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
      status: 'upcoming'
    })

    await newBooking.save()
    res.status(201).json({ message: 'Booking successful!', booking: newBooking })
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

    // Only find bookings that belong to this specific student
    const bookings = await Booking.find({ studentId })
      .sort({ date: 1, startTime: 1 })

    res.json(bookings)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch bookings' })
  }
})

// DELETE: Cancel a booking (Soft Delete)
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

// DELETE: Cancel a consultation (Organizer only)
router.delete('/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { studentEmail } = req.body; // We send the email to verify ownership

    // 1. Find the booking
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Consultation not found.' });
    }

    // 2. SECURITY CHECK: Only the organizer (the student who booked it) can cancel
    if (booking.studentId !== studentEmail) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: Only the organizer can cancel this consultation.' 
      });
    }

    // 3. DELETE (Or Soft Delete by changing status to 'canceled')
    // We'll do a real delete to keep the DB clean for now
    await Booking.findByIdAndDelete(bookingId);

    res.status(200).json({ 
        success: true, 
        message: 'Consultation successfully canceled and removed from all dashboards.' 
    });

  } catch (error) {
    console.error('Cancellation Error:', error);
    res.status(500).json({ success: false, message: 'Server error during cancellation.' });
  }
});

module.exports = router
