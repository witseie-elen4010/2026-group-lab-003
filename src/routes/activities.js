const express = require('express');
const router = express.Router();
const Activity = require('../models/activity');
const Booking = require('../models/booking');
const Availability = require('../models/Availability');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toPlainActivity(activity) {
    const value = typeof activity.toObject === 'function' ? activity.toObject() : activity;
    return {
        ...value,
        id: String(value._id || value.id)
    };
}

function uniqueValues(values) {
    return [...new Set(values.filter(Boolean).map(String))];
}

function enrichActivityIdentity(activity) {
    const metadata = activity.metadata || {};
    const actorId = metadata.actorId || activity.userId || activity.userEmail;
    const actorEmail = metadata.actorEmail || activity.userEmail || activity.userId;
    const role = activity.userRole || metadata.userRole || '';
    const studentId = metadata.studentId || metadata.studentEmail || (role === 'student' ? actorId : null);
    const studentEmail = metadata.studentEmail || metadata.studentId || (role === 'student' ? actorEmail : null);
    const lecturerId = metadata.lecturerId || metadata.lecturerEmail || (role === 'lecturer' ? actorId : null);
    const lecturerEmail = metadata.lecturerEmail || metadata.lecturerId || (role === 'lecturer' ? actorEmail : null);

    return {
        ...activity,
        userId: activity.userId || actorId || studentId || lecturerId || null,
        userEmail: activity.userEmail || actorEmail || studentEmail || lecturerEmail || null,
        userRole: role,
        metadata: {
            ...metadata,
            userId: metadata.userId || activity.userId || actorId || null,
            userEmail: metadata.userEmail || activity.userEmail || actorEmail || null,
            userRole: metadata.userRole || role,
            actorId: actorId || null,
            actorEmail: actorEmail || null,
            studentId: studentId || null,
            studentEmail: studentEmail || null,
            lecturerId: lecturerId || null,
            lecturerEmail: lecturerEmail || null,
            participantIDs: uniqueValues([
                ...(Array.isArray(metadata.participantIDs) ? metadata.participantIDs : []),
                studentId
            ]),
            participantEmails: uniqueValues([
                ...(Array.isArray(metadata.participantEmails) ? metadata.participantEmails : []),
                studentEmail
            ]),
            audienceIds: uniqueValues([
                ...(Array.isArray(metadata.audienceIds) ? metadata.audienceIds : []),
                actorId,
                studentId,
                lecturerId
            ]),
            audienceEmails: uniqueValues([
                ...(Array.isArray(metadata.audienceEmails) ? metadata.audienceEmails : []),
                actorEmail,
                studentEmail,
                lecturerEmail
            ])
        }
    };
}

function getRequester(req) {
    const values = [
        req.headers['x-user-email'],
        req.headers['x-user-id'],
        req.query.userEmail,
        req.query.userId,
        req.session?.userEmail
    ].filter(Boolean);

    return {
        values: [...new Set(values.map(String))],
        role: req.headers['x-user-role'] || req.query.role || ''
    };
}

function activityMatchesRequester(activity, requester) {
    if (requester.values.length === 0) return false;

    const metadata = activity.metadata || {};
    const searchableValues = [
        activity.userId,
        activity.userEmail,
        metadata.userId,
        metadata.userEmail,
        metadata.actorId,
        metadata.actorEmail,
        metadata.studentId,
        metadata.studentEmail,
        metadata.lecturerId,
        metadata.lecturerEmail,
        ...(Array.isArray(metadata.participantIDs) ? metadata.participantIDs : []),
        ...(Array.isArray(metadata.participantEmails) ? metadata.participantEmails : []),
        ...(Array.isArray(metadata.audienceIds) ? metadata.audienceIds : []),
        ...(Array.isArray(metadata.audienceEmails) ? metadata.audienceEmails : [])
    ].filter(Boolean).map(String);

    return requester.values.some(value => searchableValues.includes(String(value)));
}

function bookingToActivity(booking) {
    const participants = Array.isArray(booking.participantIDs) ? booking.participantIDs : [];
    const canceled = booking.status === 'canceled';
    const id = String(booking._id || `${booking.studentId}-${booking.lecturerId}-${booking.date}-${booking.startTime}`);

    return enrichActivityIdentity({
        id: `booking-${id}`,
        type: canceled ? 'canceled' : 'created',
        description: `${canceled ? 'Canceled' : 'Booked'} ${booking.module || 'consultation'} consultation`,
        user: booking.studentId,
        userId: booking.studentId,
        userEmail: booking.studentId,
        userRole: 'student',
        timestamp: booking.createdAt || new Date(),
        metadata: {
            source: 'booking',
            bookingId: id,
            course: booking.module,
            module: booking.module,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            venue: booking.venue,
            topic: booking.topic,
            status: booking.status,
            studentId: booking.studentId,
            studentEmail: booking.studentId,
            lecturerId: booking.lecturerId,
            lecturerEmail: booking.lecturerId,
            participantIDs: participants,
            participantEmails: participants,
            audienceIds: uniqueValues([booking.studentId, booking.lecturerId, ...participants]),
            audienceEmails: uniqueValues([booking.studentId, booking.lecturerId, ...participants])
        }
    });
}

function availabilityToActivities(availability) {
    return (availability.weeklySchedule || []).flatMap(daySchedule => {
        return (daySchedule.slots || []).map(slot => {
            const id = String(slot._id || `${availability.lecturerEmail}-${daySchedule.dayOfWeek}-${slot.start}`);
            return enrichActivityIdentity({
                id: `slot-${id}`,
                type: 'created',
                description: `Available for ${slot.course} consultations`,
                user: availability.lecturerName || availability.lecturerEmail,
                userId: availability.lecturerEmail,
                userEmail: availability.lecturerEmail,
                userRole: 'lecturer',
                timestamp: availability.updatedAt || new Date(),
                metadata: {
                    source: 'availability',
                    slotId: id,
                    lecturerId: availability.lecturerEmail,
                    lecturerEmail: availability.lecturerEmail,
                    lecturerName: availability.lecturerName,
                    dayOfWeek: daySchedule.dayOfWeek,
                    day: DAY_NAMES[daySchedule.dayOfWeek] || String(daySchedule.dayOfWeek),
                    course: slot.course,
                    startTime: slot.start,
                    endTime: slot.end,
                    duration: slot.duration,
                    venue: slot.venue,
                    maxStudents: slot.maxStudents,
                    audienceIds: [availability.lecturerEmail],
                    audienceEmails: [availability.lecturerEmail]
                }
            });
        });
    });
}

// GET current user's relevant activities
router.get('/', async (req, res) => {
    try {
        const requester = getRequester(req);
        if (requester.values.length === 0) {
            return res.json([]);
        }

        const [activities, bookings, availabilities] = await Promise.all([
            Activity.find().sort({ timestamp: -1 }).limit(500),
            Booking.find().sort({ createdAt: -1 }).limit(500).lean(),
            Availability.find().lean()
        ]);

        const combinedActivities = [
            ...activities.map(activity => enrichActivityIdentity(toPlainActivity(activity))),
            ...bookings.map(bookingToActivity),
            ...availabilities.flatMap(availabilityToActivities)
        ]
            .filter(activity => activityMatchesRequester(activity, requester))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 500);

        res.json(combinedActivities);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// POST new activity
router.post('/', async (req, res) => {
    try {
        const metadata = req.body.metadata || {};
        const activityData = enrichActivityIdentity({
            ...req.body,
            userEmail: req.body.userEmail || req.headers['x-user-email'] || metadata.userEmail || metadata.actorEmail,
            userRole: req.body.userRole || req.headers['x-user-role'] || metadata.userRole,
            userId: req.body.userId || req.headers['x-user-id'] || metadata.userId || metadata.actorId,
            metadata: {
                ...metadata,
                actorId: metadata.actorId || req.headers['x-user-id'] || req.body.userId,
                actorEmail: metadata.actorEmail || req.headers['x-user-email'] || req.body.userEmail
            }
        });
        const activity = await Activity.create(activityData);
        res.status(201).json(activity);
    } catch (error) {
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

// DELETE current user's activity records
router.delete('/', async (req, res) => {
    try {
        const requester = getRequester(req);
        if (requester.values.length === 0) {
            return res.json({ message: 'No signed-in user activity to clear' });
        }

        const activities = await Activity.find();
        const activityIds = activities
            .map(toPlainActivity)
            .filter(activity => activityMatchesRequester(activity, requester))
            .map(activity => activity._id)
            .filter(Boolean);

        await Activity.deleteMany({ _id: { $in: activityIds } });
        res.json({ message: 'Your activities were cleared' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear activities' });
    }
});

module.exports = router;
