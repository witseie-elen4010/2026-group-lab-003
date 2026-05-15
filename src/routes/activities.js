const express = require('express');
const router = express.Router();
const Activity = require('../models/activity');

// GET all activities
router.get('/', async (req, res) => {
    try {
        const activities = await Activity.find().sort({ timestamp: -1 }).limit(500);
        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// POST new activity
router.post('/', async (req, res) => {
    try {
        const activity = await Activity.create(req.body);
        res.status(201).json(activity);
    } catch (error) {
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

// DELETE all activities
router.delete('/', async (req, res) => {
    try {
        await Activity.deleteMany({});
        res.json({ message: 'All activities cleared' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear activities' });
    }
});

module.exports = router;