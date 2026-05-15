class BookingConflictChecker {
    constructor() {
        this.storageKey = 'sychro_consultations';
    }

    /**
     * Check if a lecturer has a conflicting session
     * @param {string} lecturerName - Lecturer's full name
     * @param {string} date - Date string (YYYY-MM-DD)
     * @param {string} startTime - Start time (HH:MM)
     * @param {number} durationMinutes - Duration in minutes
     * @param {string} excludeSessionId - session ID to ignore for rescheduling
     * @returns {object} { hasConflict: boolean, conflictingSession: object|null, message: string }
     */
    checkConflict(lecturerName, date, startTime, durationMinutes, excludeSessionId = null) {
        const allSessions = this.getAllSessions();
        const conflicts = [];

        const proposedStart = this.timeToMinutes(startTime);
        const proposedEnd = proposedStart + durationMinutes;

        for (const session of allSessions) {
            // Skip excluded session (for rescheduling)
            if (excludeSessionId && session.id === excludeSessionId) continue;

            // Skip canceled sessions
            if (session.status === 'canceled') continue;

            // Skip different lecturers
            if (session.lecturerName !== lecturerName) continue;

            // Skip different dates
            if (session.date !== date) continue;

            // Check time overlap
            const existingStart = this.timeToMinutes(session.time);
            const existingEnd = existingStart + (session.duration || 0);

            if (this.isOverlapping(proposedStart, proposedEnd, existingStart, existingEnd)) {
                conflicts.push(session);
            }
        }

        if (conflicts.length > 0) {
            return {
                hasConflict: true,
                conflictingSession: conflicts[0],
                allConflicts: conflicts,
                message: this.buildConflictMessage(conflicts[0])
            };
        }

        return {
            hasConflict: false,
            conflictingSession: null,
            allConflicts: [],
            message: ''
        };
    }

    /**
     * Check if a student has a conflicting booking
     * @param {string} studentName - Student's full name
     * @param {string} date - Date string (YYYY-MM-DD)
     * @param {string} startTime - Start time (HH:MM)
     * @param {number} durationMinutes - Duration in minutes
     * @param {string} excludeSessionId - session ID to ignore
     * @returns {object}
     */
    checkStudentConflict(studentName, date, startTime, durationMinutes, excludeSessionId = null) {
        const allSessions = this.getAllSessions();

        const proposedStart = this.timeToMinutes(startTime);
        const proposedEnd = proposedStart + durationMinutes;

        for (const session of allSessions) {
            if (excludeSessionId && session.id === excludeSessionId) continue;
            if (session.status === 'canceled') continue;
            if (session.studentName !== studentName) continue;
            if (session.date !== date) continue;

            const existingStart = this.timeToMinutes(session.time);
            const existingEnd = existingStart + (session.duration || 0);

            if (this.isOverlapping(proposedStart, proposedEnd, existingStart, existingEnd)) {
                return {
                    hasConflict: true,
                    conflictingSession: session,
                    message: `You already have a session booked at ${this.formatTime(session.time)} with ${session.lecturerName}`
                };
            }
        }

        return {
            hasConflict: false,
            conflictingSession: null,
            message: ''
        };
    }

    /**
     * Get available time slots for a lecturer on a given date
     * @param {string} lecturerName - Lecturer's full name
     * @param {string} date - Date string (YYYY-MM-DD)
     * @param {number} durationMinutes - Desired duration
     * @param {string} workStartTime - Lecturer's work day start (default: 08:00)
     * @param {string} workEndTime - Lecturer's work day end (default: 17:00)
     * @returns {array} Array of available time slots
     */
    getAvailableSlots(lecturerName, date, durationMinutes, workStartTime = '08:00', workEndTime = '17:00') {
        const allSessions = this.getAllSessions();
        const bookedSlots = [];

        // Get all booked slots for this lecturer on this date
        for (const session of allSessions) {
            if (session.status === 'canceled') continue;
            if (session.lecturerName !== lecturerName) continue;
            if (session.date !== date) continue;

            bookedSlots.push({
                start: this.timeToMinutes(session.time),
                end: this.timeToMinutes(session.time) + (session.duration || 0)
            });
        }

        // Sort by start time
        bookedSlots.sort((a, b) => a.start - b.start);

        // Find available slots
        const workStart = this.timeToMinutes(workStartTime);
        const workEnd = this.timeToMinutes(workEndTime);
        const availableSlots = [];

        let currentTime = workStart;

        for (const slot of bookedSlots) {
            if (currentTime + durationMinutes <= slot.start) {
                availableSlots.push(this.minutesToTime(currentTime));
            }
            currentTime = Math.max(currentTime, slot.end);
        }

        // Check after last booking
        if (currentTime + durationMinutes <= workEnd) {
            availableSlots.push(this.minutesToTime(currentTime));
        }

        return availableSlots;
    }

    /**
     * Validate a booking and return detailed results
     * @param {object} bookingData - Full booking details
     * @returns {object} 
     */
    validateBooking(bookingData) {
        const errors = [];
        const warnings = [];

        // Required fields
        if (!bookingData.lecturerName) errors.push('Lecturer name is required');
        if (!bookingData.studentName) errors.push('Student name is required');
        if (!bookingData.date) errors.push('Date is required');
        if (!bookingData.time) errors.push('Time is required');
        if (!bookingData.duration) errors.push('Duration is required');

        if (errors.length > 0) {
            return { isValid: false, errors, warnings };
        }

        // Check lecturer conflict
        const lecturerConflict = this.checkConflict(
            bookingData.lecturerName,
            bookingData.date,
            bookingData.time,
            bookingData.duration,
            bookingData.id || null
        );

        if (lecturerConflict.hasConflict) {
            errors.push(lecturerConflict.message);
        }

        // Check student conflict
        const studentConflict = this.checkStudentConflict(
            bookingData.studentName,
            bookingData.date,
            bookingData.time,
            bookingData.duration,
            bookingData.id || null
        );

        if (studentConflict.hasConflict) {
            errors.push(studentConflict.message);
        }

        // Past date warning
        const sessionDateTime = new Date(`${bookingData.date}T${bookingData.time}`);
        if (sessionDateTime < new Date()) {
            warnings.push('This session is scheduled in the past');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    // HELPERS

    getAllSessions() {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : [];
    }

    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    minutesToTime(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    isOverlapping(start1, end1, start2, end2) {
        return start1 < end2 && start2 < end1;
    }

    formatTime(time) {
        if (!time) return '--:--';
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return `${displayHour}:${minutes} ${period}`;
    }

    buildConflictMessage(session) {
        return `Time conflict: ${session.lecturerName} already has "${session.topic || 'a session'}" ` +
               `with ${session.studentName} at ${this.formatTime(session.time)} ` +
               `(${session.duration || 0}min) for ${session.courseCode || 'course'}`;
    }
}

// INITIALIZE
const conflictChecker = new BookingConflictChecker();
window.conflictChecker = conflictChecker;