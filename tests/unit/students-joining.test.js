/**
 * @jest-environment jsdom
 */

global.sessionStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = value; },
    removeItem(key) { delete this.store[key]; },
    clear() { this.store = {}; }
};

global.localStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = value; },
    removeItem(key) { delete this.store[key]; },
    clear() { this.store = {}; }
};

const testSessions = [
    {
        _id: '1',
        module: 'ELEN4010',
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        status: 'upcoming',
        studentId: 'alice@uni.edu',
        topic: 'Arrays',
        participantIDs: [],
        lecturerId: 'dr.smith@uni.edu'
    },
    {
        _id: '2',
        module: 'ELEN4006',
        date: new Date().toISOString().split('T')[0],
        startTime: '11:00',
        status: 'ongoing',
        studentId: 'bob@uni.edu',
        topic: 'Sorting',
        participantIDs: ['bob@uni.edu'],
        lecturerId: 'dr.jones@uni.edu'
    }
];

global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve(testSessions)
    })
);


beforeEach(() => {
    document.body.innerHTML = `
        <div id="sessions-list"></div>
        <div id="empty-state" class="hidden"></div>
        <select id="course-filter"><option value="all">All</option></select>
        <input id="search-input" type="text" />
        <button id="refresh-btn"></button>
    `;
    global.localStorage.clear();
    global.sessionStorage.clear();
    global.alert = jest.fn();
});

const fs = require('fs');
const path = require('path');

const sourceCode = fs.readFileSync(
    path.join(__dirname, '..', '..', 'public', 'js', 'students-joining.js'),
    'utf8'
);

const classOnly = sourceCode
    .replace('const studentJoiner = new StudentSessionJoiner();', '')
    .replace('window.studentJoiner = studentJoiner;', '');

const fullCode = classOnly + '\nmodule.exports = { StudentSessionJoiner };';
const tempPath = path.join(__dirname, '..', '..', 'public', 'js', 'students-joining-testable.js');
fs.writeFileSync(tempPath, fullCode);

const { StudentSessionJoiner } = require('../../public/js/students-joining-testable');

afterAll(() => {
    try { fs.unlinkSync(tempPath); } catch (e) {}
});

describe('Join Peer Session - Epic #4', () => {
    beforeEach(() => {
        global.sessionStorage.setItem('sychro_current_user', JSON.stringify({
            fullName: 'Carol',
            email: 'carol@uni.edu'
        }));
    });

    test('should call API to join session', async () => {
        global.fetch.mockClear();
        // First call: loadSessions on init
        // Second call: join request
        // Third call: reload sessions after join
        global.fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(testSessions) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(testSessions) });

        const joiner = new StudentSessionJoiner();
        await joiner.init();

        await joiner.joinSession('1');

        expect(global.fetch).toHaveBeenCalledWith('/api/bookings/1/join', expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'carol@uni.edu' })
        }));
    });

    test('should reload sessions after joining', async () => {
        global.fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(testSessions) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(testSessions) });

        const joiner = new StudentSessionJoiner();
        await joiner.init();
        await joiner.joinSession('1');

        // Should have called GET /api/bookings twice (init + reload after join)
        const getCalls = global.fetch.mock.calls.filter(call => 
            call[0] === '/api/bookings?status=upcoming,ongoing'
        );
        expect(getCalls.length).toBeGreaterThanOrEqual(2);
    });

    test('should show alert if not logged in', async () => {
        global.sessionStorage.clear();
        global.fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(testSessions) });

        const joiner = new StudentSessionJoiner();
        await joiner.init();
        await joiner.joinSession('1');

        expect(global.alert).toHaveBeenCalledWith('You must be logged in to join a session.');
    });
});