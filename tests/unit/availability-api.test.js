const request = require('supertest');
const mongoose = require('mongoose');

// Create a shared mock save function
const mockSave = jest.fn().mockResolvedValue(true);

// Mock the Availability model correctly
jest.mock('../../src/models/Availability', () => {
    // Constructor for new Availability instances
    const MockAvailability = function (data) {
        Object.assign(this, data);
        this.save = mockSave;                       // attach the spy
        this.weeklySchedule = data?.weeklySchedule || [];
        this.courses = data?.courses || [];
    };
    MockAvailability.findOne = jest.fn();
    return MockAvailability;
});

const app = require('../../src/app');
const Availability = require('../../src/models/Availability');

describe('Lecturer Availability API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSave.mockClear();
    });

    describe('GET /api/availability', () => {
        it('returns 401 if X-Lecturer-Id header is missing', async () => {
            const response = await request(app).get('/api/availability');
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Unauthorized');
            expect(Availability.findOne).not.toHaveBeenCalled();
        });

        it('creates and returns empty availability when none exists', async () => {
            Availability.findOne.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/availability')
                .set('X-Lecturer-Id', 'test@example.com');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.availability).toMatchObject({
                lecturerEmail: 'test@example.com',
                weeklySchedule: [],
                courses: []
            });
            expect(Availability.findOne).toHaveBeenCalledWith({ lecturerEmail: 'test@example.com' });
            expect(mockSave).toHaveBeenCalled();  // ✅ now works
        });

        it('returns existing availability when found', async () => {
            const existing = {
                lecturerEmail: 'test@example.com',
                weeklySchedule: [
                    { dayOfWeek: 1, slots: [{ start: '09:00', end: '10:00', duration: 60, course: 'MATH101', maxStudents: 5 }] }
                ],
                courses: ['MATH101']
            };
            Availability.findOne.mockResolvedValue(existing);

            const response = await request(app)
                .get('/api/availability')
                .set('X-Lecturer-Id', 'test@example.com');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.availability).toEqual(existing);
        });
    });

    describe('POST /api/availability/slot', () => {
        it('returns 401 without lecturer id', async () => {
            const response = await request(app)
                .post('/api/availability/slot')
                .send({ dayOfWeek: 1, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', maxStudents: 5 });
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('validates required fields', async () => {
            const response = await request(app)
                .post('/api/availability/slot')
                .set('X-Lecturer-Id', 'test@example.com')
                .send({ dayOfWeek: 1, start: '09:00' });
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Missing required fields');
        });

        it('validates dayOfWeek range (1-5)', async () => {
            const response = await request(app)
                .post('/api/availability/slot')
                .set('X-Lecturer-Id', 'test@example.com')
                .send({
                    dayOfWeek: 0,
                    start: '09:00',
                    end: '10:00',
                    duration: 60,
                    course: 'MATH101',
                    maxStudents: 5
                });
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Invalid day of week (must be 1-5)');
        });

        it('adds a new slot to existing day', async () => {
            const existing = {
                lecturerEmail: 'test@example.com',
                weeklySchedule: [{ dayOfWeek: 1, slots: [] }],
                courses: [],
                save: mockSave
            };
            Availability.findOne.mockResolvedValue(existing);

            const response = await request(app)
                .post('/api/availability/slot')
                .set('X-Lecturer-Id', 'test@example.com')
                .set('X-Lecturer-Name', 'Test Lecturer')
                .send({
                    dayOfWeek: 1,
                    start: '09:00',
                    end: '10:00',
                    duration: 60,
                    course: 'MATH101',
                    maxStudents: 5
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(existing.weeklySchedule[0].slots).toHaveLength(1);
            expect(existing.weeklySchedule[0].slots[0]).toMatchObject({
                start: '09:00',
                end: '10:00',
                duration: 60,
                course: 'MATH101',
                maxStudents: 5
            });
            expect(existing.courses).toEqual(['MATH101']);
            expect(mockSave).toHaveBeenCalled();
        });

        it('creates new day schedule if day does not exist', async () => {
            const existing = {
                lecturerEmail: 'test@example.com',
                weeklySchedule: [],
                courses: [],
                save: mockSave
            };
            Availability.findOne.mockResolvedValue(existing);

            const response = await request(app)
                .post('/api/availability/slot')
                .set('X-Lecturer-Id', 'test@example.com')
                .send({
                    dayOfWeek: 3,
                    start: '13:00',
                    end: '14:00',
                    duration: 60,
                    course: 'PHYS101',
                    maxStudents: 3
                });

            expect(response.status).toBe(200);
            expect(existing.weeklySchedule).toHaveLength(1);
            expect(existing.weeklySchedule[0].dayOfWeek).toBe(3);
            expect(existing.weeklySchedule[0].slots).toHaveLength(1);
            expect(existing.courses).toEqual(['PHYS101']);
        });
    });

    describe('DELETE /api/availability/slot', () => {
        it('returns 401 without lecturer id', async () => {
            const response = await request(app)
                .delete('/api/availability/slot')
                .send({ dayOfWeek: 1, slotId: '123' });
            expect(response.status).toBe(401);
        });

        it('validates required fields', async () => {
            const response = await request(app)
                .delete('/api/availability/slot')
                .set('X-Lecturer-Id', 'test@example.com')
                .send({ dayOfWeek: 1 });
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Missing required fields');
        });

        it('removes a slot and updates courses', async () => {
            const slotId = new mongoose.Types.ObjectId().toString();
            const existing = {
                lecturerEmail: 'test@example.com',
                weeklySchedule: [
                    { dayOfWeek: 1, slots: [{ _id: slotId, course: 'MATH101' }, { _id: 'other', course: 'PHYS101' }] }
                ],
                courses: ['MATH101', 'PHYS101'],
                save: mockSave
            };
            Availability.findOne.mockResolvedValue(existing);

            const response = await request(app)
                .delete('/api/availability/slot')
                .set('X-Lecturer-Id', 'test@example.com')
                .send({ dayOfWeek: 1, slotId });

            expect(response.status).toBe(200);
            expect(existing.weeklySchedule[0].slots).toHaveLength(1);
            expect(existing.weeklySchedule[0].slots[0].course).toBe('PHYS101');
            expect(existing.courses).toEqual(['PHYS101']);
            expect(mockSave).toHaveBeenCalled();
        });

        it('removes the entire day schedule if no slots remain', async () => {
            const slotId = new mongoose.Types.ObjectId().toString();
            const existing = {
                lecturerEmail: 'test@example.com',
                weeklySchedule: [
                    { dayOfWeek: 1, slots: [{ _id: slotId, course: 'MATH101' }] },
                    { dayOfWeek: 2, slots: [] }
                ],
                courses: ['MATH101'],
                save: mockSave
            };
            Availability.findOne.mockResolvedValue(existing);

            const response = await request(app)
                .delete('/api/availability/slot')
                .set('X-Lecturer-Id', 'test@example.com')
                .send({ dayOfWeek: 1, slotId });

            expect(response.status).toBe(200);
            expect(existing.weeklySchedule).toHaveLength(1);
            expect(existing.weeklySchedule[0].dayOfWeek).toBe(2);
            expect(existing.courses).toEqual([]);
            expect(mockSave).toHaveBeenCalled();
        });

        it('returns 404 if schedule not found', async () => {
            Availability.findOne.mockResolvedValue(null);

            const response = await request(app)
                .delete('/api/availability/slot')
                .set('X-Lecturer-Id', 'test@example.com')
                .send({ dayOfWeek: 1, slotId: '123' });

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('Schedule not found');
        });

        it('returns 404 if day not found', async () => {
            const existing = { lecturerEmail: 'test@example.com', weeklySchedule: [] };
            Availability.findOne.mockResolvedValue(existing);

            const response = await request(app)
                .delete('/api/availability/slot')
                .set('X-Lecturer-Id', 'test@example.com')
                .send({ dayOfWeek: 1, slotId: '123' });

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('Day availability not found');
        });

        it('returns 404 if slot not found', async () => {
            const existing = {
                lecturerEmail: 'test@example.com',
                weeklySchedule: [{ dayOfWeek: 1, slots: [{ _id: 'other', course: 'MATH101' }] }]
            };
            Availability.findOne.mockResolvedValue(existing);

            const response = await request(app)
                .delete('/api/availability/slot')
                .set('X-Lecturer-Id', 'test@example.com')
                .send({ dayOfWeek: 1, slotId: 'nonexistent' });

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('Slot not found');
        });
    });
});