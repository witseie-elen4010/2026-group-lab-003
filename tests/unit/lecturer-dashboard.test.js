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

// Mock fetch for databse-connected dashboard
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
    })
);

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
        <div id="session-modal" class="session-modal-overlay hidden" aria-hidden="true">
            <div id="session-detail-content"></div>
        </div>
        <button id="refresh-btn"></button>
        <button id="close-session-modal"></button>
    `;

    global.localStorage.clear();
    global.sessionStorage.clear();
    global.fetch.mockClear();
});

// Load the class from your source file
const fs = require('fs');
const path = require('path');

// Read and evaluate the source file to get the class
const sourceCode = fs.readFileSync(
    path.join(__dirname, '..', '..', 'public', 'js', 'lecturer-dashboard.js'),
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
const tempPath = path.join(__dirname, '..', '..', 'public', 'js', 'lecturer-dashboard-testable.js');
fs.writeFileSync(tempPath, fullCode);

const { LecturerScheduleManager } = require('../../public/js/lecturer-dashboard-testable');

// Clean up temp file after tests
afterAll(() => {
    try {
        fs.unlinkSync(tempPath);
    } catch (e) {
        // ignore
    }
});

const waitForInit = () => new Promise(resolve => setTimeout(resolve, 50));


describe('Lecturer Dashboard', () => {

    describe('Initialization', () => {
        test('should create instance without errors', async () => {
            const manager = new LecturerScheduleManager();
            expect(manager).toBeDefined();
            expect(manager.sessions).toEqual([]);
            expect(manager.filteredSessions).toEqual([]);
        });

        test('should load current lecturer from sessionStorage', async () => {
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

        test('should fallback to localStorage', async () => {
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

        test('should set currentLecturer to null if no user found', async () => {
            const manager = new LecturerScheduleManager();
            expect(manager.currentLecturer).toBeNull();
        });
    });

    describe('Data Loading', () => {
       
        test('should return empty array if no sessions exist', async () => {
            const manager = new LecturerScheduleManager();
            expect(manager.sessions).toEqual([]);
        });

        test('should show bookings made against lecturer idNumber on the dashboard', async () => {
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({
                fullName: 'Dr. Stephen',
                email: 'stephen@wits.ac.za',
                idNumber: '2540701'
            }));
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([
                    {
                        _id: 'booking-1',
                        lecturerId: '2540701',
                        studentId: 'student@wits.ac.za',
                        module: 'ELEN4010',
                        date: '2026-05-18',
                        startTime: '08:00',
                        endTime: '09:00',
                        status: 'upcoming',
                        topic: 'Arrays',
                        participantIDs: ['student@wits.ac.za']
                    }
                ])
            });

            const manager = new LecturerScheduleManager();
            await waitForInit();

            expect(fetch).toHaveBeenCalledWith('/api/bookings/lecturer/bookings?email=2540701');
            expect(manager.sessions).toHaveLength(1);
            expect(document.getElementById('schedule-list').textContent).toContain('ELEN4010');
            expect(document.getElementById('schedule-list').textContent).toContain('Arrays');
            expect(document.getElementById('empty-state').classList.contains('hidden')).toBe(true);
        });

        test('should group multiple student bookings for the same consultation slot', async () => {
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({
                fullName: 'Dr. Stephen',
                email: 'stephen@wits.ac.za',
                idNumber: '2540701'
            }));
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([
                    {
                        _id: 'booking-1',
                        lecturerId: '2540701',
                        studentId: 'alice@wits.ac.za',
                        module: 'ELEN4010',
                        date: '2026-05-18',
                        startTime: '08:00',
                        endTime: '09:00',
                        status: 'upcoming',
                        topic: 'First student topic',
                        createdAt: '2026-05-01T08:00:00.000Z',
                        participantIDs: ['alice@wits.ac.za']
                    },
                    {
                        _id: 'booking-2',
                        lecturerId: '2540701',
                        studentId: 'bob@wits.ac.za',
                        module: 'ELEN4010',
                        date: '2026-05-18',
                        startTime: '08:00',
                        endTime: '09:00',
                        status: 'upcoming',
                        topic: 'Second student topic',
                        createdAt: '2026-05-01T08:05:00.000Z',
                        participantIDs: ['bob@wits.ac.za']
                    }
                ])
            });

            const manager = new LecturerScheduleManager();
            await waitForInit();

            expect(manager.sessions).toHaveLength(1);
            expect(manager.sessions[0].joinedStudents).toEqual(['alice@wits.ac.za', 'bob@wits.ac.za']);
            expect(manager.sessions[0].topic).toBe('First student topic');
            expect(manager.sessions[0].studentTopics).toEqual({
                'alice@wits.ac.za': 'First student topic',
                'bob@wits.ac.za': 'Second student topic'
            });
            expect(document.querySelectorAll('.session-card')).toHaveLength(1);
            expect(document.getElementById('schedule-list').textContent).toContain('2 joined');
            expect(document.getElementById('schedule-list').textContent).toContain('First student topic');
            expect(document.getElementById('schedule-list').textContent).not.toContain('Second student topic');

            document.querySelector('[data-session-action="details"]').click();

            expect(document.getElementById('session-detail-content').textContent).toContain('Students Joined (2)');
            expect(document.querySelector('.student-list-heading').textContent).toContain('Topic');
            expect(document.getElementById('session-detail-content').textContent).toContain('First student topic');
            expect(document.getElementById('session-detail-content').textContent).toContain('Second student topic');
            expect(document.getElementById('session-detail-content').textContent).toContain('alice@wits.ac.za');
            expect(document.getElementById('session-detail-content').textContent).toContain('bob@wits.ac.za');
            expect(document.getElementById('session-modal').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('session-modal').getAttribute('aria-hidden')).toBe('false');

            document.getElementById('close-session-modal').click();

            expect(document.getElementById('session-modal').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('session-modal').getAttribute('aria-hidden')).toBe('true');
        });

        test('should cancel every booking in a grouped lecturer session', async () => {
            global.confirm = jest.fn(() => true);
            global.alert = jest.fn();
            global.sessionStorage.setItem('sychro_current_user', JSON.stringify({
                fullName: 'Dr. Stephen',
                email: 'stephen@wits.ac.za',
                idNumber: '2540701'
            }));
            global.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        {
                            _id: 'booking-1',
                            lecturerId: '2540701',
                            studentId: 'alice@wits.ac.za',
                            module: 'ELEN4010',
                            date: '2026-05-18',
                            startTime: '08:00',
                            endTime: '09:00',
                            status: 'upcoming',
                            topic: 'Arrays',
                            participantIDs: ['alice@wits.ac.za']
                        },
                        {
                            _id: 'booking-2',
                            lecturerId: '2540701',
                            studentId: 'bob@wits.ac.za',
                            module: 'ELEN4010',
                            date: '2026-05-18',
                            startTime: '08:00',
                            endTime: '09:00',
                            status: 'upcoming',
                            topic: 'Arrays',
                            participantIDs: ['bob@wits.ac.za']
                        }
                    ])
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true, modifiedCount: 2 })
                });

            const manager = new LecturerScheduleManager();
            await waitForInit();

            await manager.cancelSession('booking-1');

            expect(fetch).toHaveBeenCalledWith('/api/bookings/session/cancel', expect.objectContaining({
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingIds: ['booking-1', 'booking-2'] })
            }));
            expect(manager.sessions[0].status).toBe('canceled');
            expect(document.getElementById('schedule-list').textContent).toContain('canceled');
            expect(global.alert).not.toHaveBeenCalled();
        });

    });

    describe('Statistics Calculation', () => {
    
        test('should handle empty sessions gracefully', async () => {
            const manager = new LecturerScheduleManager();
            manager.updateStats();

            expect(document.getElementById('total-sessions').textContent).toBe('0');
            expect(document.getElementById('total-joined').textContent).toBe('0');
            expect(document.getElementById('upcoming-count').textContent).toBe('0');
            expect(document.getElementById('completed-today').textContent).toBe('0');
        });
    });


    describe('Rendering',() => {
        test('should show empty state when no sessions', () => {
            const manager = new LecturerScheduleManager();
            manager.render();
            expect(document.getElementById('empty-state').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('schedule-list').innerHTML).toBe('');
        });

        test('should display current date', async () => {
            const manager = new LecturerScheduleManager();
            await waitForInit();
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
            jest.useFakeTimers().setSystemTime(new Date('2026-05-06T12:00:00z'))
            const today = new Date().toISOString().split('T')[0];
            expect(manager.isThisWeek(today)).toBe(true);
            jest.useRealTimers();
        });

        test('isThisWeek handles null', () => {
            expect(manager.isThisWeek(null)).toBe(false);
        });
    });

});
