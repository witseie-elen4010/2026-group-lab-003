// src/middleware/bookingValidator.js

const validateLecturerHours = async (req, res, next) => {
    try {
        // 1. Get the requested times from the frontend request
        // (Adjust these variable names if your frontend sends them differently)
        const { startTime, endTime, lecturerId } = req.body;

        // 2. Fetch the specific lecturer's working hours from your Database
        // Note: You will need to import your User/Lecturer model at the top of this file
        // const lecturer = await User.findById(lecturerId);
        // const lecturerStart = lecturer.availableStartTime; 
        // const lecturerEnd = lecturer.availableEndTime;

        /* --- MOCK DATA FOR TESTING --- */
        /* Remove this mock data once you connect your actual Database model above */
        const lecturerStart = "09:00"; 
        const lecturerEnd = "16:00";
        /* ----------------------------- */

        // 3. The Validation Logic: Compare the times
        // (Standard HH:MM string comparison works perfectly in JavaScript)
        if (startTime < lecturerStart || endTime > lecturerEnd) {
            return res.status(400).json({
                success: false,
                message: `Booking rejected. This lecturer is only available between ${lecturerStart} and ${lecturerEnd}.`
            });
        }

        // 4. If the time is VALID, call next()! 
        // This tells Express: "Validation passed, send it to the next function."
        next();

    } catch (error) {
        console.error("Validation Error:", error);
        res.status(500).json({ success: false, message: "Server error during validation." });
    }
};

module.exports = { validateLecturerHours };