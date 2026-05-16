const express = require('express');
const router = express.Router();
const Availability = require('../models/Availability');
const Booking = require('../models/booking');

// GET lecturer's availability with booking status per slot
router.get('/', async (req, res) => {
    try {
        const lecturerEmail = req.headers['x-lecturer-id'];

        if (!lecturerEmail) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        let availability = await Availability.findOne({ lecturerEmail });

        if (!availability) {
            // Create empty availability for new user
            availability = new Availability({
                lecturerEmail,
                weeklySchedule: []
            });
            await availability.save();
        }

        // Fetch all non-canceled bookings for this lecturer to determine which slots have bookings
        const bookings = await Booking.find({
            lecturerId: lecturerEmail,
            status: { $ne: 'canceled' }
        });

        // Build a Set of slot IDs that have at least one booking
        const bookedSlotIds = new Set();
        bookings.forEach(booking => {
            // Get day of week from booking date (0=Sun, 1=Mon, ... 6=Sat)
            const bookingDate = new Date(booking.date);
            const bookingDayOfWeek = bookingDate.getDay();

            // Check all slots across all days to find matches
            availability.weeklySchedule.forEach(daySchedule => {
                if (daySchedule.dayOfWeek !== bookingDayOfWeek) return;
                daySchedule.slots.forEach(slot => {
                    // Check time overlap: the slot time range and booking time range overlap
                    if (slot.start < booking.endTime && slot.end > booking.startTime) {
                        bookedSlotIds.add(slot._id.toString());
                    }
                });
            });
        });

        res.json({
            success: true,
            availability,
            bookedSlotIds: Array.from(bookedSlotIds)
        });
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ success: false, message: 'Error fetching availability' });
    }
});

// POST add a new slot
router.post('/slot', async (req, res) => {
    try {
        const lecturerEmail = req.headers['x-lecturer-id'];
        if (!lecturerEmail) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { dayOfWeek, start, end, duration, course, venue, maxStudents } = req.body;

        // Validation – dayOfWeek can be 0, so check explicitly
        if (dayOfWeek === undefined || !start || !end || !duration || !course || !venue || !maxStudents) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        if (dayOfWeek < 1 || dayOfWeek > 5) {
            return res.status(400).json({ success: false, message: 'Invalid day of week (must be 1-5)' });
        }

        // Validate start < end
        if (start >= end) {
            return res.status(400).json({ success: false, message: 'Start time must be before end time' });
        }

        let availability = await Availability.findOne({ lecturerEmail });
        if (!availability) {
            availability = new Availability({ lecturerEmail, weeklySchedule: [] });
        }

        // Find or create the day schedule
        let daySchedule = availability.weeklySchedule.find(d => d.dayOfWeek === dayOfWeek);
        if (!daySchedule) {
            // Push a new day and then retrieve the actual subdocument
            availability.weeklySchedule.push({ dayOfWeek, slots: [] });
            daySchedule = availability.weeklySchedule[availability.weeklySchedule.length - 1];
        }

        // Check for time conflicts with existing slots on the same day
        // A lecturer cannot be in two places at once — overlapping slots are not allowed
        const hasConflict = daySchedule.slots.some(existingSlot => {
            return start < existingSlot.end && end > existingSlot.start;
        });

        if (hasConflict) {
            return res.status(409).json({
                success: false,
                message: 'Time conflict: This slot overlaps with an existing slot on this day. A lecturer cannot be in two places at once.'
            });
        }

        // Add the new slot to the day's slots array
        daySchedule.slots.push({
            start,
            end,
            duration,
            course: course.toUpperCase(),
            venue: venue.trim(),
            maxStudents
        });

        // Update courses list
        const courses = [...new Set(availability.weeklySchedule.flatMap(d => d.slots.map(s => s.course)))];
        availability.courses = courses;
        availability.updatedAt = new Date();

        // Save once after all modifications
        await availability.save();

        res.json({ success: true, message: 'Slot added successfully', availability });
    } catch (error) {
        console.error('Error adding slot:', error);
        res.status(500).json({ success: false, message: 'Error adding slot' });
    }
});

// DELETE a slot
router.delete('/slot', async (req, res) => {
    try {
        const lecturerEmail = req.headers['x-lecturer-id'];

        if (!lecturerEmail) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { dayOfWeek, slotId } = req.body;

        if (!dayOfWeek || !slotId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const availability = await Availability.findOne({ lecturerEmail });

        if (!availability) {
            return res.status(404).json({ success: false, message: 'Schedule not found' });
        }

        // Find the day availability
        const daySchedule = availability.weeklySchedule.find(d => d.dayOfWeek === dayOfWeek);

        if (!daySchedule) {
            return res.status(404).json({ success: false, message: 'Day availability not found' });
        }

        // Remove the slot
        const slotIndex = daySchedule.slots.findIndex(s => s._id.toString() === slotId);

        if (slotIndex === -1) {
            return res.status(404).json({ success: false, message: 'Slot not found' });
        }

        daySchedule.slots.splice(slotIndex, 1);
        if (daySchedule.slots.length === 0) {
            availability.weeklySchedule = availability.weeklySchedule.filter(d => d.dayOfWeek !== dayOfWeek);
        }

        availability.markModified('weeklySchedule');

        // Update courses list
        const courses = [...new Set(availability.weeklySchedule.flatMap(d => d.slots.map(s => s.course)))];
        availability.courses = courses;
        availability.updatedAt = new Date();
        await availability.save();

        res.json({ success: true, message: 'Slot cancelled successfully', availability: availability });
    } catch (error) {
        console.error('Error cancelling slot:', error);
        res.status(500).json({ success: false, message: 'Error cancelling slot' });
    }
});

// PUT update an existing slot
router.put('/slot/:slotId', async (req, res) => {
    try {
        const lecturerEmail = req.headers['x-lecturer-id'];
        if (!lecturerEmail) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { slotId } = req.params;
        const { dayOfWeek, start, end, duration, course, venue, maxStudents } = req.body;

        if (dayOfWeek === undefined || !start || !end || !duration || !course || !venue || !maxStudents) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        if (dayOfWeek < 1 || dayOfWeek > 5) {
            return res.status(400).json({ success: false, message: 'Invalid day of week (must be 1-5)' });
        }
        if (start >= end) {
            return res.status(400).json({ success: false, message: 'Start time must be before end time' });
        }

        const availability = await Availability.findOne({ lecturerEmail });
        if (!availability) {
            return res.status(404).json({ success: false, message: 'Schedule not found' });
        }

        // Find the day schedule
        const daySchedule = availability.weeklySchedule.find(d => d.dayOfWeek === dayOfWeek);
        if (!daySchedule) {
            return res.status(404).json({ success: false, message: 'Day not found' });
        }

        // Find the slot subdocument by _id
        const slot = daySchedule.slots.id(slotId);
        if (!slot) {
            return res.status(404).json({ success: false, message: 'Slot not found' });
        }

        // Check for time conflicts with OTHER slots on the same day (exclude this one)
        const hasConflict = daySchedule.slots.some(existingSlot => {
            if (existingSlot._id.toString() === slotId) return false;
            return start < existingSlot.end && end > existingSlot.start;
        });
        if (hasConflict) {
            return res.status(409).json({
                success: false,
                message: 'Time conflict: This time overlaps with another slot on this day. A lecturer cannot be in two places at once.'
            });
        }

        // Update the slot fields
        slot.start = start;
        slot.end = end;
        slot.duration = duration;
        slot.course = course.toUpperCase();
        slot.venue = venue.trim();
        slot.maxStudents = maxStudents;

        // Update courses list
        const courses = [...new Set(availability.weeklySchedule.flatMap(d => d.slots.map(s => s.course)))];
        availability.courses = courses;
        availability.updatedAt = new Date();

        availability.markModified('weeklySchedule');
        await availability.save();

        res.json({ success: true, message: 'Slot updated successfully', availability });
    } catch (error) {
        console.error('Error updating slot:', error);
        res.status(500).json({ success: false, message: 'Error updating slot' });
    }
});

module.exports = router;
