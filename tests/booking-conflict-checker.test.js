global.localStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = value; },
    removeItem(key) { delete this.store[key]; },
    clear() { this.store = {}; }
};

beforeEach(() => {
    global.localStorage.clear();
});

// Loading the class
const fs = require('fs');
const path = require('path');

const sourceCode = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'booking-conflict-checker.js'),
    'utf8'
);

const classOnly = sourceCode
    .replace('const conflictChecker = new BookingConflictChecker();', '')
    .replace('window.conflictChecker = conflictChecker;', '');

const fullCode = classOnly + '\nmodule.exports = { BookingConflictChecker };';

const tempPath = path.join(__dirname, '..', 'public', 'js', 'booking-conflict-checker-testable.js');
fs.writeFileSync(tempPath, fullCode);

const { BookingConflictChecker } = require('../public/js/booking-conflict-checker-testable');

afterAll(() => {
    try { fs.unlinkSync(tempPath); } catch (e) { }
});

describe('Booking Conflict Checker', () => {

    describe('Time Overlap Detection', () => {
        let checker;

        beforeEach(() => {
            checker = new BookingConflictChecker();
        });

        test('should detect overlapping sessions', () => {
            expect(checker.isOverlapping(540, 570, 555, 585)).toBe(true);
        });

        test('should detect session starting during another', () => {
            expect(checker.isOverlapping(540, 600, 550, 580)).toBe(true);
        });

        test('should detect session ending during another', () => {
            expect(checker.isOverlapping(540, 570, 510, 550)).toBe(true);
        });

        test('should detect exact same time', () => {
            expect(checker.isOverlapping(540, 570, 540, 570)).toBe(true);
        });

        test('should not flag back-to-back sessions', () => {
            expect(checker.isOverlapping(540, 570, 570, 600)).toBe(false);
        });

        test('should not flag sessions with gap', () => {
            expect(checker.isOverlapping(540, 570, 580, 610)).toBe(false);
        });

        test('should not flag completely separate sessions', () => {
            expect(checker.isOverlapping(480, 510, 540, 570)).toBe(false);
        });
    });

    describe('Lecturer Conflict Detection', () => {
        let checker;

        beforeEach(() => {
            checker = new BookingConflictChecker();
        });

        test('should detect conflict with existing session', () => {
            const existingSessions = [
                {
                    id: '1',
                    lecturerName: 'Dr. Stephen',
                    date: '2026-04-29',
                    time: '10:00',
                    duration: 30,
                    status: 'upcoming',
                    studentName: 'Alice',
                    topic: 'Arrays help',
                    courseCode: 'ELEN4010'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const result = checker.checkConflict('Dr. Stephen', '2026-04-29', '10:15', 15);

            expect(result.hasConflict).toBe(true);
            expect(result.conflictingSession.id).toBe('1');
            expect(result.message).toContain('Time conflict');
            expect(result.message).toContain('Dr. Stephen');
        });

        test('should not flag when no conflict exists', () => {
            const existingSessions = [
                {
                    id: '1',
                    lecturerName: 'Dr. Stephen',
                    date: '2026-04-29',
                    time: '10:00',
                    duration: 30,
                    status: 'upcoming',
                    studentName: 'Alice',
                    topic: 'Arrays',
                    courseCode: 'ELEN4010'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const result = checker.checkConflict('Dr. Stephen', '2026-04-29', '10:30', 15);

            expect(result.hasConflict).toBe(false);
        });

        test('should ignore canceled sessions', () => {
            const existingSessions = [
                {
                    id: '1',
                    lecturerName: 'Dr. Stephen',
                    date: '2026-04-29',
                    time: '10:00',
                    duration: 30,
                    status: 'canceled',
                    studentName: 'Alice',
                    topic: 'Arrays',
                    courseCode: 'ELEN4010'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const result = checker.checkConflict('Dr. Stephen', '2026-04-29', '10:00', 30);

            expect(result.hasConflict).toBe(false);
        });

        test('should ignore different lecturer', () => {
            const existingSessions = [
                {
                    id: '1',
                    lecturerName: 'Dr. Stephen',
                    date: '2026-04-29',
                    time: '10:00',
                    duration: 30,
                    status: 'upcoming',
                    studentName: 'Alice',
                    topic: 'Arrays',
                    courseCode: 'ELEN4010'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const result = checker.checkConflict('Dr. Stephen', '2026-04-29', '10:00', 30);

            expect(result.hasConflict).toBe(true);
        });

        test('should ignore different date', () => {
            const existingSessions = [
                {
                    id: '1',
                    lecturerName: 'Dr. Stephen',
                    date: '2026-04-28',
                    time: '10:00',
                    duration: 30,
                    status: 'upcoming',
                    studentName: 'Alice',
                    topic: 'Arrays',
                    courseCode: 'ELEN4010'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const result = checker.checkConflict('Dr. Stephen', '2026-04-29', '10:00', 30);

            expect(result.hasConflict).toBe(false);
        });

        test('should exclude specified session ID (for rescheduling)', () => {
            const existingSessions = [
                {
                    id: '1',
                    lecturerName: 'Dr. Stephen',
                    date: '2026-04-29',
                    time: '10:00',
                    duration: 30,
                    status: 'upcoming',
                    studentName: 'Alice',
                    topic: 'Arrays',
                    courseCode: 'ELEN4010'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const result = checker.checkConflict('Dr. Stephen', '2026-04-29', '10:00', 30, '1');

            expect(result.hasConflict).toBe(false);
        });
    });

    
    describe('Student Conflict Detection', () => {
        let checker;

        beforeEach(() => {
            checker = new BookingConflictChecker();
        });

        test('should detect student double-booking', () => {
            const existingSessions = [
                {
                    id: '1',
                    studentName: 'Alice',
                    lecturerName: 'Dr. Stephen',
                    date: '2026-04-29',
                    time: '10:00',
                    duration: 30,
                    status: 'upcoming',
                    courseCode: 'ELEN4010'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const result = checker.checkStudentConflict('Alice', '2026-04-29', '10:15', 15);

            expect(result.hasConflict).toBe(true);
            expect(result.message).toContain('already have a session');
            expect(result.message).toContain('10:00 AM');
            expect(result.message).toContain('Dr. Stephen');
        });

        test('should not flag student for different times', () => {
            const existingSessions = [
                {
                    id: '1',
                    studentName: 'Alice',
                    lecturerName: 'Dr. Stephen',
                    date: '2026-04-29',
                    time: '10:00',
                    duration: 30,
                    status: 'upcoming',
                    courseCode: 'ELEN4010'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const result = checker.checkStudentConflict('Alice', '2026-04-29', '11:00', 15);

            expect(result.hasConflict).toBe(false);
        });
    });

    describe('Available Slots', () => {
        test('should return available time slots', () => {
            const checker = new BookingConflictChecker();
            const existingSessions = [
                {
                    id: '1',
                    lecturerName: 'Dr. Smith',
                    date: '2026-04-29',
                    time: '10:00',
                    duration: 30,
                    status: 'upcoming',
                    studentName: 'Alice'
                },
                {
                    id: '2',
                    lecturerName: 'Dr. Smith',
                    date: '2026-04-29',
                    time: '14:00',
                    duration: 60,
                    status: 'upcoming',
                    studentName: 'Bob'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const slots = checker.getAvailableSlots('Dr. Smith', '2026-04-29', 30, '08:00', '17:00');

            expect(slots).toContain('08:00');
            expect(slots).toContain('10:30');
            expect(slots).toContain('15:00');
            expect(slots.length).toBeGreaterThan(0);
        });

        test('should return empty array if no slots available', () => {
            const checker = new BookingConflictChecker();
            const existingSessions = [
                {
                    id: '1',
                    lecturerName: 'Dr. Smith',
                    date: '2026-04-29',
                    time: '08:00',
                    duration: 540,
                    status: 'upcoming',
                    studentName: 'Alice'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const slots = checker.getAvailableSlots('Dr. Smith', '2026-04-29', 60, '08:00', '17:00');

            expect(slots.length).toBe(0);
        });
    });

    describe('Booking Validation', () => {
        test('should validate a valid booking', () => {
            const checker = new BookingConflictChecker();
            const booking = {
                lecturerName: 'Dr. Smith',
                studentName: 'Alice',
                date: '2026-04-29',
                time: '10:00',
                duration: 30
            };

            const result = checker.validateBooking(booking);

            expect(result.isValid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        test('should reject booking with conflicts', () => {
            const checker = new BookingConflictChecker();
            const existingSessions = [
                {
                    id: '1',
                    lecturerName: 'Dr. Smith',
                    date: '2026-04-29',
                    time: '10:00',
                    duration: 30,
                    status: 'upcoming',
                    studentName: 'Bob',
                    topic: 'Arrays',
                    courseCode: 'ELEN4010'
                }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(existingSessions));

            const booking = {
                lecturerName: 'Dr. Smith',
                studentName: 'Alice',
                date: '2026-04-29',
                time: '10:15',
                duration: 15
            };

            const result = checker.validateBooking(booking);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Time conflict');
        });

        test('should reject booking with missing fields', () => {
            const checker = new BookingConflictChecker();
            const booking = {};

            const result = checker.validateBooking(booking);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBe(5);
        });
    });

    describe('Helper Functions', () => {
        let checker;

        beforeEach(() => {
            checker = new BookingConflictChecker();
        });

        test('timeToMinutes should convert correctly', () => {
            expect(checker.timeToMinutes('08:00')).toBe(480);
            expect(checker.timeToMinutes('14:30')).toBe(870);
            expect(checker.timeToMinutes(null)).toBe(0);
        });

        test('minutesToTime should convert correctly', () => {
            expect(checker.minutesToTime(480)).toBe('08:00');
            expect(checker.minutesToTime(870)).toBe('14:30');
        });

        test('formatTime should format correctly', () => {
            expect(checker.formatTime('09:00')).toBe('9:00 AM');
            expect(checker.formatTime('14:30')).toBe('2:30 PM');
        });

        test('buildConflictMessage should include details', () => {
            const session = {
                lecturerName: 'Dr. Smith',
                studentName: 'Alice',
                time: '10:00',
                duration: 30,
                topic: 'Arrays',
                courseCode: 'ELEN4010'
            };

            const message = checker.buildConflictMessage(session);

            expect(message).toContain('Dr. Smith');
            expect(message).toContain('Alice');
            expect(message).toContain('Arrays');
            expect(message).toContain('ELEN4010');
            expect(message).toContain('10:00 AM');
        });
    });

});