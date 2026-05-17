const request = require('supertest');
const mongoose = require('mongoose');

const mockAvailabilityStore = [];

class MockAvailability {
  constructor(data = {}) {
    this.lecturerEmail = data.lecturerEmail;
    this.weeklySchedule = (data.weeklySchedule || []).map(MockAvailability.cloneDay);
    this.courses = [...(data.courses || [])];
    this.updatedAt = data.updatedAt;
  }

  static cloneSlot(slot) {
    return {
      _id: slot._id || new mongoose.Types.ObjectId(),
      start: slot.start,
      end: slot.end,
      duration: slot.duration,
      course: slot.course,
      venue: slot.venue,
      maxStudents: slot.maxStudents,
    };
  }

  static cloneDay(day) {
    const slots = (day.slots || []).map(MockAvailability.cloneSlot);
    slots.id = id => slots.find(slot => slot._id.toString() === id) || null;
    return {
      dayOfWeek: day.dayOfWeek,
      slots,
    };
  }

  static async findOne(query) {
    return mockAvailabilityStore.find(item => item.lecturerEmail === query.lecturerEmail) || null;
  }

  static async create(data) {
    const availability = new MockAvailability(data);
    await availability.save();
    return availability;
  }

  static async deleteMany() {
    mockAvailabilityStore.length = 0;
  }

  async save() {
    const existingIndex = mockAvailabilityStore.findIndex(item => item.lecturerEmail === this.lecturerEmail);
    if (existingIndex === -1) {
      mockAvailabilityStore.push(this);
    } else {
      mockAvailabilityStore[existingIndex] = this;
    }
    return this;
  }

  markModified() {}
}

jest.mock('../../src/models/Availability', () => MockAvailability);

// Mock Booking so the availability route's Booking.find() call returns empty results
// without needing a MongoDB connection
jest.mock('../../src/models/booking', () => ({
  find: jest.fn().mockResolvedValue([])
}));

const app = require('../../src/app');
const Availability = require('../../src/models/Availability');

const testLecturerEmail = 'lecturer@integration.test';

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
          venue: 'Room 101',
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
        venue: 'Room 101',
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
          venue: 'Lab 2',
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
        .send({ dayOfWeek: 1, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', venue: 'Room 101', maxStudents: 5 });

      await request(app)
        .post('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 1, start: '10:00', end: '11:00', duration: 60, course: 'MATH101', venue: 'Room 101', maxStudents: 5 });

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
        .send({ dayOfWeek: 2, start: '13:00', end: '14:00', duration: 60, course: 'PHYS101', venue: 'Lab 2', maxStudents: 4 });

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
        .send({ dayOfWeek: 0, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', venue: 'Room 101', maxStudents: 5 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid day of week (must be 1-5)');
    });

    it('returns 400 for invalid dayOfWeek (6)', async () => {
      const res = await request(app)
        .post('/api/availability/slot')
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 6, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', venue: 'Room 101', maxStudents: 5 });

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

  describe('PUT /api/availability/slot/:slotId', () => {
    let slotId;

    beforeEach(async () => {
      const schedule = await Availability.create({
        lecturerEmail: testLecturerEmail,
        lecturerName: 'Test Lecturer',
        weeklySchedule: [
          {
            dayOfWeek: 2,
            slots: [
              {
                start: '09:00',
                end: '10:00',
                duration: 60,
                course: 'MATH101',
                venue: 'Room 101',
                maxStudents: 5,
              },
              {
                start: '11:00',
                end: '12:00',
                duration: 60,
                course: 'PHYS101',
                venue: 'Lab 1',
                maxStudents: 3,
              },
            ],
          },
        ],
        courses: ['MATH101', 'PHYS101'],
      });
      slotId = schedule.weeklySchedule[0].slots[0]._id.toString();
    });

    it('updates an existing slot and refreshes the course list', async () => {
      const res = await request(app)
        .put(`/api/availability/slot/${slotId}`)
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({
          dayOfWeek: 2,
          start: '09:30',
          end: '10:30',
          duration: 60,
          course: 'chem101',
          venue: ' Lab 7 ',
          maxStudents: 4,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Slot updated successfully');

      const updated = await Availability.findOne({ lecturerEmail: testLecturerEmail });
      expect(updated.weeklySchedule[0].slots[0]).toMatchObject({
        start: '09:30',
        end: '10:30',
        duration: 60,
        course: 'CHEM101',
        venue: 'Lab 7',
        maxStudents: 4,
      });
      expect(updated.courses).toEqual(['CHEM101', 'PHYS101']);
    });

    it('rejects slot updates without a lecturer id', async () => {
      const res = await request(app)
        .put(`/api/availability/slot/${slotId}`)
        .send({ dayOfWeek: 2 });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Unauthorized');
    });

    it('rejects slot updates with missing fields, invalid days, and invalid time ranges', async () => {
      const missing = await request(app)
        .put(`/api/availability/slot/${slotId}`)
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 2 });

      const invalidDay = await request(app)
        .put(`/api/availability/slot/${slotId}`)
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 6, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', venue: 'Room', maxStudents: 1 });

      const invalidTime = await request(app)
        .put(`/api/availability/slot/${slotId}`)
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 2, start: '11:00', end: '10:00', duration: 60, course: 'MATH101', venue: 'Room', maxStudents: 1 });

      expect(missing.status).toBe(400);
      expect(missing.body.message).toBe('Missing required fields');
      expect(invalidDay.status).toBe(400);
      expect(invalidDay.body.message).toBe('Invalid day of week (must be 1-5)');
      expect(invalidTime.status).toBe(400);
      expect(invalidTime.body.message).toBe('Start time must be before end time');
    });

    it('returns 404 when updating a missing schedule, day, or slot', async () => {
      await Availability.deleteMany({});

      const missingSchedule = await request(app)
        .put(`/api/availability/slot/${slotId}`)
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 2, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', venue: 'Room', maxStudents: 1 });

      await Availability.create({
        lecturerEmail: testLecturerEmail,
        weeklySchedule: [{ dayOfWeek: 3, slots: [] }],
      });

      const missingDay = await request(app)
        .put(`/api/availability/slot/${slotId}`)
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 2, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', venue: 'Room', maxStudents: 1 });

      const missingSlot = await request(app)
        .put(`/api/availability/slot/${new mongoose.Types.ObjectId()}`)
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({ dayOfWeek: 3, start: '09:00', end: '10:00', duration: 60, course: 'MATH101', venue: 'Room', maxStudents: 1 });

      expect(missingSchedule.status).toBe(404);
      expect(missingSchedule.body.message).toBe('Schedule not found');
      expect(missingDay.status).toBe(404);
      expect(missingDay.body.message).toBe('Day not found');
      expect(missingSlot.status).toBe(404);
      expect(missingSlot.body.message).toBe('Slot not found');
    });

    it('rejects updates that overlap another slot on the same day', async () => {
      const res = await request(app)
        .put(`/api/availability/slot/${slotId}`)
        .set('X-Lecturer-Id', testLecturerEmail)
        .send({
          dayOfWeek: 2,
          start: '11:30',
          end: '12:30',
          duration: 60,
          course: 'MATH101',
          venue: 'Room 101',
          maxStudents: 5,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Time conflict');
    });
  });
});
