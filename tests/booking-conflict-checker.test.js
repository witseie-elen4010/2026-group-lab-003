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

            expect(result.hasConflict).toBe(false);
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

});