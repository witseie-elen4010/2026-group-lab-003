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
    global.fetch = undefined;
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
    const futureDate = () => new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const testSessions = [
        {
            id: '1',
            courseCode: 'ELEN4010',
            date: futureDate(),
            time: '10:00',
            endTime: '10:30',
            duration: 30,
            status: 'upcoming',
            studentName: 'Alice',
            topic: 'Arrays',
            joinedStudents: [],
            maxStudents: 3,
            lecturerName: 'Dr. Smith'
        },
        {
            id: '2',
            courseCode: 'ELEN4006',
            date: futureDate(),
            time: '11:00',
            endTime: '11:45',
            duration: 45,
            status: 'ongoing',
            studentName: 'Bob',
            topic: 'Sorting',
            joinedStudents: ['Bob'],
            maxStudents: 2,
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

    test('should show remaining spaces for each session', () => {
        new StudentSessionJoiner();
        const text = document.getElementById('sessions-list').textContent;
        expect(text).toContain('3 spaces left');
        expect(text).toContain('1 space left');
    });

    test('should show configured courses even when no peer session is available yet', async () => {
        global.fetch = jest.fn(url => {
            if (url === '/api/bookings/form-data') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        {
                            courses: ['ELEN50'],
                            weeklySchedule: [
                                { slots: [{ course: 'COMS3009' }] }
                            ]
                        }
                    ])
                });
            }

            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([])
            });
        });

        new StudentSessionJoiner();
        await new Promise(resolve => setTimeout(resolve, 0));

        const options = Array.from(document.getElementById('course-filter').options).map(option => option.value);
        expect(options).toContain('ELEN50');
        expect(options).toContain('COMS3009');
    });

    test('should render remaining space from API capacity', async () => {
        global.fetch = jest.fn(url => {
            if (url === '/api/bookings/form-data') {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
            }

            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([
                    {
                        _id: 'api-session',
                        module: 'ELEN50',
                        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                        startTime: '10:00',
                        endTime: '11:00',
                        status: 'upcoming',
                        studentId: 'owner@uni.edu',
                        participantIDs: Array.from({ length: 9 }, (_, index) => `student${index}@uni.edu`),
                        maxStudents: 10,
                        spacesLeft: 1
                    }
                ])
            });
        });

        new StudentSessionJoiner();
        await new Promise(resolve => setTimeout(resolve, 0));

        const text = document.getElementById('sessions-list').textContent;
        expect(text).toContain('9/10 joined');
        expect(text).toContain('1 space left');
        expect(text).not.toContain('Full');
    });

    test('should order sessions happening soonest first', () => {
        const soon = new Date(Date.now() + 86400000);
        const later = new Date(Date.now() + 172800000);

        global.localStorage.setItem('sychro_consultations', JSON.stringify([
            {
                id: 'later',
                courseCode: 'ELEN4010',
                date: later.toISOString().split('T')[0],
                time: '12:00',
                endTime: '13:00',
                status: 'upcoming',
                studentName: 'Later Student',
                topic: 'Later topic',
                joinedStudents: [],
                maxStudents: 3
            },
            {
                id: 'soon',
                courseCode: 'ELEN4010',
                date: soon.toISOString().split('T')[0],
                time: '09:00',
                endTime: '10:00',
                status: 'upcoming',
                studentName: 'Soon Student',
                topic: 'Soon topic',
                joinedStudents: [],
                maxStudents: 3
            }
        ]));

        new StudentSessionJoiner();
        const cards = Array.from(document.querySelectorAll('.session-card'));
        expect(cards[0].textContent).toContain('Soon topic');
        expect(cards[1].textContent).toContain('Later topic');
    });

    test('should not display full sessions', () => {
        global.localStorage.setItem('sychro_consultations', JSON.stringify([
            {
                id: 'full',
                courseCode: 'ELEN4010',
                date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                time: '10:00',
                endTime: '11:00',
                status: 'upcoming',
                studentName: 'Full Student',
                topic: 'Full topic',
                joinedStudents: ['A', 'B'],
                maxStudents: 2
            },
            {
                id: 'open',
                courseCode: 'ELEN4010',
                date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                time: '12:00',
                endTime: '13:00',
                status: 'upcoming',
                studentName: 'Open Student',
                topic: 'Open topic',
                joinedStudents: ['A'],
                maxStudents: 2
            }
        ]));

        new StudentSessionJoiner();
        const text = document.getElementById('sessions-list').textContent;
        expect(text).not.toContain('Full topic');
        expect(text).toContain('Open topic');
    });

    test('should not display sessions after their meeting time has passed', () => {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        global.localStorage.setItem('sychro_consultations', JSON.stringify([
            {
                id: 'past',
                courseCode: 'ELEN4010',
                date: yesterday,
                time: '10:00',
                endTime: '11:00',
                status: 'upcoming',
                studentName: 'Past Student',
                topic: 'Past topic',
                joinedStudents: [],
                maxStudents: 2
            },
            {
                id: 'future',
                courseCode: 'ELEN4010',
                date: tomorrow,
                time: '10:00',
                endTime: '11:00',
                status: 'upcoming',
                studentName: 'Future Student',
                topic: 'Future topic',
                joinedStudents: [],
                maxStudents: 2
            }
        ]));

        new StudentSessionJoiner();
        const text = document.getElementById('sessions-list').textContent;
        expect(text).not.toContain('Past topic');
        expect(text).toContain('Future topic');
    });
});
