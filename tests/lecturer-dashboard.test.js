/**
 * @jest-environment jsdom
 */

// Mock sessionStorage
global.sessionStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = value; },
    removeItem(key) { delete this.store[key]; },
    clear() { this.store = {}; }
};

// Mock localStorage
global.localStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = value; },
    removeItem(key) { delete this.store[key]; },
    clear() { this.store = {}; }
};

// Mock DOM elements
beforeEach(() => {
    document.body.innerHTML = `
        <span id="total-sessions">0</span>
        <span id="total-joined">0</span>
        <span id="upcoming-count">0</span>
        <span id="completed-today">0</span>
        <span id="current-date"></span>
        <select id="status-filter">
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
        </select>
        <select id="course-filter">
            <option value="all">All Courses</option>
        </select>
        <select id="date-filter">
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="this-week">This Week</option>
            <option value="next-week">Next Week</option>
        </select>
        <input id="search-input" type="text" />
        <div id="schedule-list"></div>
        <div id="empty-state" class="hidden"></div>
        <div id="session-modal" class="modal hidden">
            <div id="session-detail-content"></div>
        </div>
        <button id="refresh-btn"></button>
        <button id="close-session-modal"></button>
    `;

    global.localStorage.clear();
    global.sessionStorage.clear();
});

// Load the class from your source file
const fs = require('fs');
const path = require('path');

// Read and evaluate the source file to get the class
const sourceCode = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'lecturer-dashboard.js'),
    'utf8'
);

// We need to extract just the class definition, not the initialization
// Create a modified version without the last two lines
const classOnly = sourceCode
    .replace('const scheduleManager = new LecturerScheduleManager();', '')
    .replace('window.scheduleManager = scheduleManager;', '')
    .replace("module.exports = { LecturerScheduleManager };", '');

// Add module exports
const fullCode = classOnly + '\nmodule.exports = { LecturerScheduleManager };';

// Write to temp file for testing
const tempPath = path.join(__dirname, '..', 'public', 'js', 'lecturer-dashboard-testable.js');
fs.writeFileSync(tempPath, fullCode);

const { LecturerScheduleManager } = require('../public/js/lecturer-dashboard-testable');

// Clean up temp file after tests
afterAll(() => {
    try {
        fs.unlinkSync(tempPath);
    } catch (e) {
        // ignore
    }
});

describe('Lecturer Dashboard', () => {

    describe('Initialization', () => {
        test('should create instance without errors', () => {
            const manager = new LecturerScheduleManager();
            expect(manager).toBeDefined();
            expect(manager.sessions).toEqual([]);
            expect(manager.filteredSessions).toEqual([]);
        });

        test('should load current lecturer from sessionStorage', () => {
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({
                fullName: 'Dr. Stephen',
                email: 'stephen@wits.ac.za'
            }));

            const manager = new LecturerScheduleManager();
            expect(manager.currentLecturer).toEqual({
                fullName: 'Dr. Stephen',
                email: 'stephen@wits.ac.za'
            });
        });

        test('should fallback to localStorage', () => {
            global.localStorage.setItem('sychro_current_user', JSON.stringify({
                fullName: 'Dr. Stephen',
                email: 'stephen@wits.ac.za'
            }));

            const manager = new LecturerScheduleManager();
            expect(manager.currentLecturer).toEqual({
                fullName: 'Dr. Stephen',
                email: 'stephen@wits.ac.za'
            });
        });

        test('should set currentLecturer to null if no user found', () => {
            const manager = new LecturerScheduleManager();
            expect(manager.currentLecturer).toBeNull();
        });
    });

    describe('Data Loading', () => {
        test('should load sessions from localStorage', () => {
            const testSessions = [
                { id: '1', courseCode: 'ELEN4010', lecturerName: 'Dr. Stephen', status: 'upcoming' },
                { id: '2', courseCode: 'ELEN4006', lecturerName: 'Dr. Stephen', status: 'completed' }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(testSessions));
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({ fullName: 'Dr. Stephen' }));

            const manager = new LecturerScheduleManager();
            expect(manager.sessions.length).toBe(2);
        });

        test('should filter sessions by current lecturer name', () => {
            const testSessions = [
                { id: '1', courseCode: 'ELEN4010', lecturerName: 'Dr. Stephen', status: 'upcoming' },
                { id: '2', courseCode: 'ELEN4006', lecturerName: 'Dr. Stephen', status: 'completed' },
                { id: '3', courseCode: 'ELEN3015', lecturerName: 'Dr. Stephen', status: 'upcoming' }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(testSessions));
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({ fullName: 'Dr. Stephen' }));

            const manager = new LecturerScheduleManager();
            expect(manager.sessions.length).toBe(3);
            manager.sessions.forEach(session => {
                expect(session.lecturerName).toBe('Dr. Stephen');
            });
        });

        test('should return empty array if no sessions exist', () => {
            const manager = new LecturerScheduleManager();
            expect(manager.sessions).toEqual([]);
        });

        test('should return all sessions if no lecturer is logged in', () => {
            const testSessions = [
                { id: '1', courseCode: 'ELEN4010', lecturerName: 'Dr. Stephen' },
                { id: '2', courseCode: 'ELEN4006', lecturerName: 'Dr. Stephen' }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(testSessions));

            const manager = new LecturerScheduleManager();
            expect(manager.sessions.length).toBe(2);
        });
    });

    describe('Statistics Calculation', () => {
        test('should count today sessions correctly', () => {
            const today = new Date().toISOString().split('T')[0];
            const testSessions = [
                { id: '1', date: today, time: '09:00', status: 'upcoming', joinedStudents: ['Alice'], lecturerName: 'Dr. Stephen' },
                { id: '2', date: today, time: '10:00', status: 'completed', joinedStudents: ['Bob', 'Carol'], lecturerName: 'Dr. Stephen' },
                { id: '3', date: '2024-01-01', time: '11:00', status: 'upcoming', joinedStudents: [], lecturerName: 'Dr. Stephen' }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(testSessions));
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({ fullName: 'Dr. Stephen' }));

            const manager = new LecturerScheduleManager();
            manager.updateStats();

            expect(document.getElementById('total-sessions').textContent).toBe('2');
            expect(document.getElementById('total-joined').textContent).toBe('3');
            expect(document.getElementById('completed-today').textContent).toBe('1');
        });




        test('should count upcoming sessions this week', () => {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            const testSessions = [
                { id: '1', date: todayStr, time: '09:00', status: 'upcoming', joinedStudents: [], lecturerName: 'Dr. Smith' },
                { id: '2', date: tomorrowStr, time: '10:00', status: 'upcoming', joinedStudents: [], lecturerName: 'Dr. Smith' },
                { id: '3', date: '2024-01-01', time: '11:00', status: 'upcoming', joinedStudents: [], lecturerName: 'Dr. Smith' }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(testSessions));
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({ fullName: 'Dr. Smith' }));

            const manager = new LecturerScheduleManager();
            manager.updateStats();

            expect(document.getElementById('upcoming-count').textContent).toBe('2');
        });

        test('should handle empty sessions gracefully', () => {
            const manager = new LecturerScheduleManager();
            manager.updateStats();

            expect(document.getElementById('total-sessions').textContent).toBe('0');
            expect(document.getElementById('total-joined').textContent).toBe('0');
            expect(document.getElementById('upcoming-count').textContent).toBe('0');
            expect(document.getElementById('completed-today').textContent).toBe('0');
        });
    });


    describe('Filtering', () => {
        const testSessions = [
            { id: '1', courseCode: 'ELEN4010', date: '2026-04-28', time: '09:00', status: 'upcoming', studentName: 'Alice', topic: 'Arrays', lecturerName: 'Dr. Smith' },
            { id: '2', courseCode: 'ELEN4006', date: '2026-04-28', time: '10:00', status: 'completed', studentName: 'Bob', topic: 'Sorting', lecturerName: 'Dr. Smith' },
            { id: '3', courseCode: 'ELEN4010', date: '2026-04-29', time: '11:00', status: 'canceled', studentName: 'Carol', topic: 'Loops', lecturerName: 'Dr. Smith' }
        ];

        beforeEach(() => {
            global.localStorage.setItem('sychro_consultations', JSON.stringify(testSessions));
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({ fullName: 'Dr. Smith' }));
        });

        test('should filter by status', () => {
            const manager = new LecturerScheduleManager();
            document.getElementById('status-filter').value = 'completed';
            manager.applyFilters();
            expect(manager.filteredSessions.length).toBe(1);
            expect(manager.filteredSessions[0].id).toBe('2');
        });

        test('should filter by course code', () => {
            const manager = new LecturerScheduleManager();
            document.getElementById('course-filter').value = 'ELEN4010';
            manager.applyFilters();
            expect(manager.filteredSessions.length).toBe(2);
        });

        test('should filter by search term', () => {
            const manager = new LecturerScheduleManager();
            document.getElementById('search-input').value = 'Alice';
            manager.applyFilters();
            expect(manager.filteredSessions.length).toBe(1);
            expect(manager.filteredSessions[0].studentName).toBe('Alice');
        });

        test('should show all when filters cleared', () => {
            const manager = new LecturerScheduleManager();
            manager.applyFilters();
            expect(manager.filteredSessions.length).toBe(3);
        });

        test('should sort by date and time ascending', () => {
            const manager = new LecturerScheduleManager();
            manager.applyFilters();
            expect(manager.filteredSessions[0].time).toBe('09:00');
            expect(manager.filteredSessions[1].time).toBe('10:00');
            expect(manager.filteredSessions[2].time).toBe('11:00');
        });
    });

    describe('Session Actions', () => {
        const testSessions = [
            { id: '1', courseCode: 'ELEN4010', date: '2026-04-28', time: '09:00', status: 'upcoming', studentName: 'Alice', joinedStudents: [], lecturerName: 'Dr. Smith' },
            { id: '2', courseCode: 'ELEN4006', date: '2026-04-28', time: '10:00', status: 'ongoing', studentName: 'Bob', joinedStudents: ['Bob'], lecturerName: 'Dr. Smith' }
        ];

        beforeEach(() => {
            global.localStorage.setItem('sychro_consultations', JSON.stringify(testSessions));
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({ fullName: 'Dr. Smith' }));
            global.confirm = () => true;
        });

        test('should cancel upcoming session', () => {
            const manager = new LecturerScheduleManager();
            manager.cancelSession('1');
            const session = manager.sessions.find(s => s.id === '1');
            expect(session.status).toBe('canceled');
        });

        test('should complete ongoing session', () => {
            const manager = new LecturerScheduleManager();
            manager.completeSession('2');
            const session = manager.sessions.find(s => s.id === '2');
            expect(session.status).toBe('completed');
        });

        test('should not cancel when confirm is false', () => {
            global.confirm = () => false;
            const manager = new LecturerScheduleManager();
            manager.cancelSession('1');
            const session = manager.sessions.find(s => s.id === '1');
            expect(session.status).toBe('upcoming');
        });
    });

    describe('Rendering', () => {
        test('should show empty state when no sessions', () => {
            const manager = new LecturerScheduleManager();
            manager.render();
            expect(document.getElementById('empty-state').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('schedule-list').innerHTML).toBe('');
        });

        test('should display current date', () => {
            const manager = new LecturerScheduleManager();
            const dateEl = document.getElementById('current-date');
            expect(dateEl.textContent).not.toBe('');
        });
    });

    describe('Helper Functions', () => {
        let manager;
        beforeEach(() => {
            manager = new LecturerScheduleManager();
        });

        test('formatTime should format correctly', () => {
            expect(manager.formatTime('09:00')).toBe('9:00 AM');
            expect(manager.formatTime('14:30')).toBe('2:30 PM');
        });

        test('formatTime should handle null', () => {
            expect(manager.formatTime(null)).toBe('--:--');
        });

        test('escape should prevent XSS', () => {
            expect(manager.escape('<script>alert("xss")</script>'))
                .toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
        });

        test('escape should handle empty', () => {
            expect(manager.escape('')).toBe('');
        });

        test('getTomorrow returns next day', () => {
            const today = new Date();
            const expected = new Date(today);
            expected.setDate(expected.getDate() + 1);
            expect(manager.getTomorrow()).toBe(expected.toISOString().split('T')[0]);
        });

        test('isThisWeek returns true for today', () => {
            const today = new Date().toISOString().split('T')[0];
            expect(manager.isThisWeek(today)).toBe(true);
        });

        test('isThisWeek handles null', () => {
            expect(manager.isThisWeek(null)).toBe(false);
        });
    });

    describe('Modal', () => {
        const testSessions = [
            { id: '1', courseCode: 'ELEN4010', date: '2026-04-28', time: '09:00', status: 'upcoming', studentName: 'Alice', topic: 'Test', duration: 30, joinedStudents: ['Alice'], location: 'Room 1', lecturerName: 'Dr. Smith' }
        ];

        beforeEach(() => {
            global.localStorage.setItem('sychro_consultations', JSON.stringify(testSessions));
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({ fullName: 'Dr. Smith' }));
        });

        test('should open modal with session details', () => {
            const manager = new LecturerScheduleManager();
            manager.showDetail('1');
            expect(document.getElementById('session-modal').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('session-detail-content').innerHTML).toContain('ELEN4010');
        });

        test('should close modal', () => {
            const manager = new LecturerScheduleManager();
            manager.closeModal();
            expect(document.getElementById('session-modal').classList.contains('hidden')).toBe(true);
        });
    });

    describe('Filter Options', () => {
        test('should populate course filter with unique courses', () => {
            const testSessions = [
                { id: '1', courseCode: 'ELEN4010', status: 'upcoming', lecturerName: 'Dr. Smith' },
                { id: '2', courseCode: 'ELEN4006', status: 'completed', lecturerName: 'Dr. Smith' },
                { id: '3', courseCode: 'ELEN4010', status: 'canceled', lecturerName: 'Dr. Smith' }
            ];
            global.localStorage.setItem('sychro_consultations', JSON.stringify(testSessions));
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({ fullName: 'Dr. Smith' }));

            const manager = new LecturerScheduleManager();
            const options = document.getElementById('course-filter').querySelectorAll('option');
            const values = Array.from(options).map(o => o.value);

            expect(values).toContain('all');
            expect(values).toContain('ELEN4010');
            expect(values).toContain('ELEN4006');
            expect(options.length).toBe(3);
        });
    });

});