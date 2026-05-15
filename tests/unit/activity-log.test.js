/**
 * @jest-environment jsdom
 */

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
    })
);

// Mock sessionStorage
global.sessionStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = value; },
    removeItem(key) { delete this.store[key]; },
    clear() { this.store = {}; }
};

beforeEach(() => {
    document.body.innerHTML = `
        <span id="total-activities">0</span>
        <span id="today-activities">0</span>
        <span id="created-count">0</span>
        <span id="canceled-count">0</span>
        <span id="active-users">0</span>
        <select id="action-type-filter">
            <option value="all">All</option>
            <option value="created">Created</option>
            <option value="joined">Joined</option>
            <option value="canceled">Canceled</option>
        </select>
        <select id="user-filter"><option value="all">All Users</option></select>
        <select id="date-range-filter"><option value="all">All Time</option></select>
        <select id="course-filter"><option value="all">All Courses</option></select>
        <input id="search-input" type="text" />
        <div id="custom-date-range" class="hidden">
            <input id="start-date" type="date" />
            <input id="end-date" type="date" />
        </div>
        <button id="apply-date-range"></button>
        <button id="clear-filters-btn"></button>
        <button id="export-activity-btn"></button>
        <button id="clear-all-btn"></button>
        <button id="bookmark-btn"></button>
        <button id="auto-refresh-toggle"><span></span></button>
        <div id="activity-timeline"></div>
        <div id="empty-state" class="hidden"></div>
        <div id="detail-modal" class="modal hidden">
            <div id="detail-content"></div>
        </div>
        <button id="close-detail-modal"></button>
        <span id="current-page">1</span>
        <span id="total-pages">1</span>
        <button id="prev-page"></button>
        <button id="next-page"></button>
    `;
    
    global.fetch.mockClear();
    global.sessionStorage.clear();
});

// Create testable copy of source file
const fs = require('fs');
const path = require('path');

const sourceCode = fs.readFileSync(
    path.join(__dirname, '..', '..', 'public', 'js', 'activity-log.js'),
    'utf8'
);

const classOnly = sourceCode
    .replace('const activityLog = new ActivityLogManager();', '')
    .replace('window.activityLog = activityLog;', '');

const fullCode = classOnly + '\nmodule.exports = { ActivityLogManager };';

const tempPath = path.join(__dirname, '..', '..', 'public', 'js', 'activity-log-testable.js');
fs.writeFileSync(tempPath, fullCode);

const { ActivityLogManager } = require('../../public/js/activity-log-testable');

afterAll(() => {
    try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
});

describe('Activity Log - Database Connected', () => {
    test('loads activities from API on init', async () => {
        const mockActivities = [
            { _id: '1', type: 'created', description: 'Test', user: 'Alice', timestamp: new Date().toISOString() }
        ];
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockActivities)
        });

        const manager = new ActivityLogManager();
        await manager.init();

        expect(global.fetch).toHaveBeenCalledWith('/api/activities');
    });

    test('logAction sends POST to API', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

        const manager = new ActivityLogManager();
        await manager.init();

        global.fetch.mockClear();
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

        global.sessionStorage.setItem('sychro_current_user', JSON.stringify({
            fullName: 'Dr. Smith',
            email: 'smith@uni.edu'
        }));

        await manager.logAction('created', 'New consultation booked');

        expect(global.fetch).toHaveBeenCalledWith('/api/activities', expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }));
    });

    test('clearAll sends DELETE to API', async () => {
        global.confirm = () => true;
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

        const manager = new ActivityLogManager();
        await manager.init();

        global.fetch.mockClear();
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

        await manager.clearAll();

        expect(global.fetch).toHaveBeenCalledWith('/api/activities', expect.objectContaining({
            method: 'DELETE'
        }));
    });
});