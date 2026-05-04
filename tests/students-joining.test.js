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
});

const fs = require('fs');
const path = require('path');

const sourceCode = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'students-joining.js'),
    'utf8'
);

const classOnly = sourceCode
    .replace('const studentJoiner = new StudentSessionJoiner();', '')
    .replace('window.studentJoiner = studentJoiner;', '');

const fullCode = classOnly + '\nmodule.exports = { StudentSessionJoiner };';
const tempPath = path.join(__dirname, '..', 'public', 'js', 'students-joining-testable.js');
fs.writeFileSync(tempPath, fullCode);

const { StudentSessionJoiner } = require('../public/js/students-joining-testable');

afterAll(() => {
    try { fs.unlinkSync(tempPath); } catch (e) {}
});

describe('Join Peer Session - Epic #4', () => {
    const testSessions = [
        {
            id: '1',
            courseCode: 'ELEN4010',
            date: new Date().toISOString().split('T')[0],
            time: '10:00',
            duration: 30,
            status: 'upcoming',
            studentName: 'Alice',
            topic: 'Arrays',
            joinedStudents: [],
            lecturerName: 'Dr. Smith'
        },
        {
            id: '2',
            courseCode: 'ELEN4006',
            date: new Date().toISOString().split('T')[0],
            time: '11:00',
            duration: 45,
            status: 'ongoing',
            studentName: 'Bob',
            topic: 'Sorting',
            joinedStudents: ['Bob'],
            lecturerName: 'Dr. Jones'
        }
    ];

    beforeEach(() => {
        global.localStorage.setItem('sychro_consultations', JSON.stringify(testSessions));
        global.sessionStorage.setItem('sychro_current_user', JSON.stringify({
            fullName: 'Carol',
            email: 'carol@uni.edu'
        }));
    });

    test('should add student name to joinedStudents on join', () => {
        const joiner = new StudentSessionJoiner();
        joiner.joinSession('1');

        const stored = JSON.parse(global.localStorage.getItem('sychro_consultations'));
        expect(stored[0].joinedStudents).toContain('Carol');
    });

    test('should not add duplicate entry', () => {
        const joiner = new StudentSessionJoiner();
        joiner.joinSession('1');
        joiner.joinSession('1');

        const stored = JSON.parse(global.localStorage.getItem('sychro_consultations'));
        expect(stored[0].joinedStudents.filter(n => n === 'Carol').length).toBe(1);
    });

    test('should show "Joined" button after joining', () => {
        const joiner = new StudentSessionJoiner();
        joiner.joinSession('1');
        joiner.filterAndRender(); // re-render
        const html = document.getElementById('sessions-list').innerHTML;
        expect(html).toContain('Joined');
    });
});