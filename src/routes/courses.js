const express = require('express');
const router = express.Router();
const Course = require('../models/Course');

// GET /api/courses — List all courses
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find().sort({ code: 1 });
    res.json(courses);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// GET /api/courses/:code — Get a single course by code
router.get('/:code', async (req, res) => {
  try {
    const course = await Course.findOne({ code: req.params.code.toUpperCase() });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(course);
  } catch (err) {
    console.error('Error fetching course:', err);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// POST /api/courses — Create a new course, or add a lecturer to an existing one
router.post('/', async (req, res) => {
  try {
    const { code, name, lecturers } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Course code and name are required' });
    }

    const codeUC = code.toUpperCase();
    const existing = await Course.findOne({ code: codeUC });

    if (existing) {
      // Course exists — add any new lecturers to the array (avoid duplicates)
      const newLecturers = (lecturers || []).filter(
        l => !existing.lecturers.includes(l)
      );
      if (newLecturers.length > 0) {
        existing.lecturers.push(...newLecturers);
        existing.name = name; // allow name update too
        await existing.save();
      }
      return res.json(existing);
    }

    const course = new Course({
      code: codeUC,
      name,
      lecturers: lecturers || []
    });

    await course.save();
    res.status(201).json(course);
  } catch (err) {
    console.error('Error creating course:', err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// PUT /api/courses/:code — Update a course
router.put('/:code', async (req, res) => {
  try {
    const { name, lecturers } = req.body;
    const course = await Course.findOneAndUpdate(
      { code: req.params.code.toUpperCase() },
      { $set: { name, lecturers } },
      { new: true, runValidators: true }
    );

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(course);
  } catch (err) {
    console.error('Error updating course:', err);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// DELETE /api/courses/:code — Delete a course
router.delete('/:code', async (req, res) => {
  try {
    const course = await Course.findOneAndDelete({ code: req.params.code.toUpperCase() });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted' });
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

module.exports = router;
