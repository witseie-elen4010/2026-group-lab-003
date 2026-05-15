const express = require('express');
const router = express.Router();
const Availability = require('../models/Availability');

// GET lecturer's availability
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

        res.json({ success: true, availability });
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ success: false, message: 'Error fetching availability' });
    }
});

// POST add a new slot
router.post('/slot', async (req, res) => {
    try {
        const lecturerEmail = req.headers['x-lecturer-id'];
        const lecturerName = req.headers['x-lecturer-name'];

        if (!lecturerEmail) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { dayOfWeek, start, end, duration, course, maxStudents } = req.body;

        // Validation
        if (dayOfWeek === undefined || !start || !end || !duration || !course || !maxStudents) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        if (dayOfWeek < 1 || dayOfWeek > 5) {
            return res.status(400).json({ success: false, message: 'Invalid day of week (must be 1-5)' });
        }

        let availability = await Availability.findOne({ lecturerEmail });

        if (!availability) {
            availability = new Availability({
                lecturerEmail,
                weeklySchedule: [],
            });
        }

        // Find or create the day availability
        let daySchedule = availability.weeklySchedule.find(d => d.dayOfWeek === dayOfWeek);

        if (!daySchedule) {
            daySchedule = { dayOfWeek, slots: [] };
            availability.weeklySchedule.push(daySchedule);
        }

        // Add the new slot
        daySchedule.slots.push({
            start,
            end,
            duration,
            course: course.toUpperCase(),
            maxStudents
        });

        // Update courses list
        const courses = [...new Set(availability.weeklySchedule.flatMap(d => d.slots.map(s => s.course)))];
        availability.courses = courses;
        availability.updatedAt = new Date();
        await availability.save();

        res.json({ success: true, message: 'Slot added successfully', availability: availability });
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

module.exports = router;
