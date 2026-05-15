const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../src/app');
const Availability = require('../../src/models/Availability');

let mongoServer;
const testLecturerEmail = 'lecturer@integration.test';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Availability.deleteMany({});
});

describe('Availability API Integration Tests', () => {
  describe('GET /api/availability', () => {
    it('returns 401 if X-Lecturer-Id header is missing', async () => {
      const res = await request(app).get('/api/availability');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Unauthorized');
    });

    it('creates and returns empty availability for a new lecturer', async () => {
      const res = await request(app)
        .get('/api/availability')
        .set('X-Lecturer-Id', testLecturerEmail);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.availability).toMatchObject({
        lecturerEmail: testLecturerEmail,
        weeklySchedule: [],
        courses: []
      });

      const saved = await Availability.findOne({ lecturerEmail: testLecturerEmail });
      expect(saved).toBeTruthy();
      expect(saved.weeklySchedule).toEqual([]);
    });

    it('returns existing availability when present', async () => {
      await Availability.create({
        lecturerEmail: testLecturerEmail,
        weeklySchedule: [
          {
            dayOfWeek: 1,
            slots: [
              {
                start: '09:00',
                end: '10:00',
                duration: 60,
                course: 'MATH101',
                maxStudents: 5,
              },
            ],
          },
        ],
        courses: ['MATH101'],
      });

      const res = await request(app)
        .get('/api/availability')
        .set('X-Lecturer-Id', testLecturerEmail);

      expect(res.status).toBe(200);
      expect(res.body.availability.weeklySchedule).toHaveLength(1);
      expect(res.body.availability.weeklySchedule[0].slots[0].course).toBe('MATH101');
    });
  });

  describe('POST /api/availability/slot', () => {
    it('adds a new slot to an existing day', async () => {
      await Availability.create({ lecturerEmail: testLecturerEmail, weeklySchedule: [] });

      const res = await request(app)
        .post('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .set('X-Lecturer-Name', 'Test Lecturer')
        .send({
          dayOfWeek: 1,
          start: '09:00',
          end: '10:00',
          duration: 60,
          course: 'MATH101',
          maxStudents: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Check response contains the slot
      expect(res.body.availability.weeklySchedule).toHaveLength(1);
      expect(res.body.availability.weeklySchedule[0].slots).toHaveLength(1);
      expect(res.body.availability.weeklySchedule[0].slots[0].course).toBe('MATH101');

      const updated = await Availability.findOne({ lecturerEmail: testLecturerEmail });
      expect(updated.weeklySchedule).toHaveLength(1);
      expect(updated.weeklySchedule[0].dayOfWeek).toBe(1);
      expect(updated.weeklySchedule[0].slots).toHaveLength(1);
      expect(updated.weeklySchedule[0].slots[0]).toMatchObject({
        start: '09:00',
        end: '10:00',
        duration: 60,
        course: 'MATH101',
        maxStudents: 5,
      });
      expect(updated.courses).toEqual(['MATH101']);
    });

    it('creates a new day entry if the day does not exist', async () => {
      await Availability.create({ lecturerEmail: testLecturerEmail, weeklySchedule: [] });

      const res = await request(app)
        .post('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({
          dayOfWeek: 3,
          start: '14:00',
          end: '15:30',
          duration: 90,
          course: 'PHYS101',
          maxStudents: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body.availability.weeklySchedule).toHaveLength(1);
      expect(res.body.availability.weeklySchedule[0].dayOfWeek).toBe(3);
      expect(res.body.availability.weeklySchedule[0].slots[0].course).toBe('PHYS101');

      const updated = await Availability.findOne({ lecturerEmail: testLecturerEmail });
      expect(updated.weeklySchedule).toHaveLength(1);
      expect(updated.weeklySchedule[0].dayOfWeek).toBe(3);
      expect(updated.weeklySchedule[0].slots[0].course).toBe('PHYS101');
      expect(updated.courses).toEqual(['PHYS101']);
    });

    it('adds multiple slots to the same day', async () => {
      await Availability.create({ lecturerEmail: testLecturerEmail, weeklySchedule: [] });

      await request(app)
        .post('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 1, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', maxStudents: 5 });

      await request(app)
        .post('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 1, start: '10:00', end: '11:00', duration: 60, course: 'MATH101', maxStudents: 5 });

      const updated = await Availability.findOne({ lecturerEmail: testLecturerEmail });
      expect(updated.weeklySchedule[0].slots).toHaveLength(2);
      expect(updated.courses).toEqual(['MATH101']);
    });

    it('updates courses list when adding a new course', async () => {
      // Create an initial schedule with a valid slot
      await Availability.create({
        lecturerEmail: testLecturerEmail,
        weeklySchedule: [
          {
            dayOfWeek: 1,
            slots: [
              {
                start: '09:00',
                end: '10:00',
                duration: 60,
                course: 'MATH101',
                maxStudents: 5,
              },
            ],
          },
        ],
        courses: ['MATH101'],
      });

      await request(app)
        .post('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 2, start: '13:00', end: '14:00', duration: 60, course: 'PHYS101', maxStudents: 4 });

      const updated = await Availability.findOne({ lecturerEmail: testLecturerEmail });
      expect(updated.courses).toEqual(['MATH101', 'PHYS101']);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 1, start: '09:00' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Missing required fields');
    });

    it('returns 400 for invalid dayOfWeek (0)', async () => {
      const res = await request(app)
        .post('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 0, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', maxStudents: 5 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid day of week (must be 1-5)');
    });

    it('returns 400 for invalid dayOfWeek (6)', async () => {
      const res = await request(app)
        .post('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 6, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', maxStudents: 5 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid day of week (must be 1-5)');
    });
  });

  describe('DELETE /api/availability/slot', () => {
    let slotId;

    beforeEach(async () => {
      const schedule = await Availability.create({
        lecturerEmail: testLecturerEmail,
        weeklySchedule: [
          {
            dayOfWeek: 1,
            slots: [
              {
                start: '09:00',
                end: '10:00',
                duration: 60,
                course: 'MATH101',
                maxStudents: 5,
              },
            ],
          },
        ],
        courses: ['MATH101'],
      });
      slotId = schedule.weeklySchedule[0].slots[0]._id.toString();
    });

    it('cancels (deletes) an existing slot', async () => {
      const res = await request(app)
        .delete('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 1, slotId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Slot cancelled successfully');

      const updated = await Availability.findOne({ lecturerEmail: testLecturerEmail });
      expect(updated.weeklySchedule).toHaveLength(0); // day removed
      expect(updated.courses).toEqual([]);
    });

    it('removes only the specified slot when multiple slots exist', async () => {
      // Add a second slot to the same day
      const doc = await Availability.findOne({ lecturerEmail: testLecturerEmail });
      doc.weeklySchedule[0].slots.push({
        start: '10:00',
        end: '11:00',
        duration: 60,
        course: 'PHYS101',
        maxStudents: 3,
      });
      await doc.save();

      const res = await request(app)
        .delete('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 1, slotId });

      expect(res.status).toBe(200);

      const updated = await Availability.findOne({ lecturerEmail: testLecturerEmail });
      expect(updated.weeklySchedule[0].slots).toHaveLength(1);
      expect(updated.weeklySchedule[0].slots[0].course).toBe('PHYS101');
      expect(updated.courses).toEqual(['PHYS101']);
    });

    it('returns 401 without lecturer id', async () => {
      const res = await request(app)
        .delete('/api/availability/slot')
        .send({ dayOfWeek: 1, slotId });

      expect(res.status).toBe(401);
    });

    it('returns 400 if dayOfWeek or slotId missing', async () => {
      const res = await request(app)
        .delete('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Missing required fields');
    });

    it('returns 404 if schedule not found', async () => {
      await Availability.deleteMany({});

      const res = await request(app)
        .delete('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 1, slotId });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Schedule not found');
    });

    it('returns 404 if day not found', async () => {
      const res = await request(app)
        .delete('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 2, slotId });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Day availability not found');
    });

    it('returns 404 if slot not found', async () => {
      const fakeSlotId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 1, slotId: fakeSlotId });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Slot not found');
    });
  });
});