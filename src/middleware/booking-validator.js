const Booking = require('../models/booking');

const validateLecturerHours = async (req, res, next) => {
    try {
       
        const { startTime, endTime, lecturerId, consultationId, date } = req.body;

        if (!startTime || !endTime || !lecturerId || !date) {
            return res.status(400).json({
                success: false,
                message: "Validation failed: Missing required fields. Please provide lecturerId, date, startTime, and endTime."
             });
        }

        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            return res.status(400).json({
                success: false,
                message: "Validation failed: Invalid time format. Please use standard HH:MM format (e.g., 14:30)."
            });
        }

        const lecturerStart = "09:00";
        const lecturerEnd = "16:00";
        
        if (startTime < lecturerStart || endTime > lecturerEnd) {
            return res.status(400).json({
                success: false,
                message: `Booking rejected. This lecturer is only available between ${lecturerStart} and ${lecturerEnd}.`
            });
        }

        if (endTime <= startTime) {
            return res.status(400).json({
                success: false,
                message: "Validation failed: The end time must be after the start time."
            });
        }

        // Check capacity for this specific time slot
        const maxCapacity = 5;
        const currentBookedStudents = await Booking.countDocuments({
            lecturerId,
            date,
            startTime,
            endTime,
            status: { $ne: 'canceled' }
        });
        
        if (currentBookedStudents >= maxCapacity) {
            return res.status(400).json({
                success: false,
                message: `Booking rejected. This consultation has reached its maximum capacity of ${maxCapacity} students.`
            });
        }

        // Warn if this is the last available spot
        if (maxCapacity - currentBookedStudents === 1) {
            req.bookingWarning = "You snagged the last spot! This consultation is now full.";
        }

        // Check daily limit for this lecturer
        const maxDailyConsultations = 10;
        const currentDailyBookings = await Booking.countDocuments({
            lecturerId,
            date,
            status: { $ne: 'canceled' }
        });
        
        if (currentDailyBookings >= maxDailyConsultations) {
            return res.status(400).json({
                success: false,
                message: `Booking rejected. This lecturer has reached their daily limit of ${maxDailyConsultations} consultations on ${date}.`
            });
        }
        
        next();

    } catch (error) {
        console.error("Validation Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error during validation."
        });
    }
};

module.exports = { validateLecturerHours };