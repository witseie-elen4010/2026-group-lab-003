const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');

// GET /api/schedules — Load the saved schedule for the logged-in lecturer
router.get('/', async (req, res) => {
  try {
    const lecturerId = req.headers['x-lecturer-id'];
    if (!lecturerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schedule = await Schedule.findOne({ lecturerId });

    if (!schedule) {
      return res.json({
        slotCapacity: 1,
        dailySessionLimit: 10,
        weeklySchedule: [],
        courses: []
      });
    }

    res.json({
      lecturerName: schedule.lecturerName,
      staffId: schedule.staffId,
      slotCapacity: schedule.slotCapacity,
      dailySessionLimit: schedule.dailySessionLimit,
      weeklySchedule: schedule.weeklySchedule,
      courses: schedule.courses || []
    });
  } catch (err) {
    console.error('Error loading schedule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/schedules — Save/update the schedule for the logged-in lecturer
router.post('/', async (req, res) => {
  try {
    const lecturerId = req.headers['x-lecturer-id'];
    const lecturerName = req.headers['x-lecturer-name'];
    if (!lecturerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { slotCapacity, dailySessionLimit, weeklySchedule, courses } = req.body;

    const update = {
      lecturerId,
      lecturerName: lecturerName || 'Unknown Lecturer',
      staffId: req.body.staffId || '',
      slotCapacity: slotCapacity || 1,
      dailySessionLimit: dailySessionLimit || 10,
      weeklySchedule: weeklySchedule || [],
      courses: courses || [],
      updatedAt: new Date()
    };

    const schedule = await Schedule.findOneAndUpdate(
      { lecturerId },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({ message: 'Schedule saved', data: schedule });
  } catch (err) {
    console.error('Error saving schedule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
