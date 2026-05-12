const request = require('supertest');

jest.mock('../../src/models/Schedule', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

const app = require('../../src/app');
const Schedule = require('../../src/models/Schedule');

describe('Schedule Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects schedule loading without a lecturer id header', async () => {
    const response = await request(app).get('/api/schedules');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
    expect(Schedule.findOne).not.toHaveBeenCalled();
  });

  it('returns default schedule values when no saved schedule exists', async () => {
    Schedule.findOne.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/schedules')
      .set('X-Lecturer-Id', 'lecturer@wits.ac.za');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      slotCapacity: 1,
      dailySessionLimit: 10,
      weeklySchedule: [],
      courses: []
    });
    expect(Schedule.findOne).toHaveBeenCalledWith({ lecturerId: 'lecturer@wits.ac.za' });
  });

  it('loads a saved lecturer schedule', async () => {
    const schedule = {
      lecturerName: 'Prof Smith',
      staffId: 'STAFF123',
      slotCapacity: 3,
      dailySessionLimit: 6,
      courses: ['ELEN4010'],
      weeklySchedule: [
        { dayOfWeek: 2, slots: [{ start: '10:00', end: '12:00' }] }
      ]
    };
    Schedule.findOne.mockResolvedValue(schedule);

    const response = await request(app)
      .get('/api/schedules')
      .set('X-Lecturer-Id', 'lecturer@wits.ac.za');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(schedule);
  });

  it('rejects schedule saving without a lecturer id header', async () => {
    const response = await request(app)
      .post('/api/schedules')
      .send({ weeklySchedule: [] });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
    expect(Schedule.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('saves a lecturer schedule using route defaults for optional values', async () => {
    const savedSchedule = {
      lecturerId: 'lecturer@wits.ac.za',
      lecturerName: 'Unknown Lecturer',
      staffId: '',
      slotCapacity: 1,
      dailySessionLimit: 10,
      weeklySchedule: [],
      courses: []
    };
    Schedule.findOneAndUpdate.mockResolvedValue(savedSchedule);

    const response = await request(app)
      .post('/api/schedules')
      .set('X-Lecturer-Id', savedSchedule.lecturerId)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Schedule saved');
    expect(response.body.data).toEqual(savedSchedule);
    expect(Schedule.findOneAndUpdate).toHaveBeenCalledWith(
      { lecturerId: savedSchedule.lecturerId },
      {
        $set: expect.objectContaining({
          lecturerId: savedSchedule.lecturerId,
          lecturerName: 'Unknown Lecturer',
          staffId: '',
          slotCapacity: 1,
          dailySessionLimit: 10,
          weeklySchedule: [],
          courses: []
        })
      },
      { upsert: true, new: true }
    );
  });

  it('saves a full lecturer schedule payload', async () => {
    const savedSchedule = {
      lecturerId: 'lecturer@wits.ac.za',
      lecturerName: 'Prof Smith',
      staffId: 'STAFF123',
      slotCapacity: 4,
      dailySessionLimit: 8,
      weeklySchedule: [
        { dayOfWeek: 3, slots: [{ start: '13:00', end: '15:00' }] }
      ],
      courses: ['ELEN4010', 'COMS3009']
    };
    Schedule.findOneAndUpdate.mockResolvedValue(savedSchedule);

    const response = await request(app)
      .post('/api/schedules')
      .set('X-Lecturer-Id', savedSchedule.lecturerId)
      .set('X-Lecturer-Name', savedSchedule.lecturerName)
      .send({
        staffId: savedSchedule.staffId,
        slotCapacity: savedSchedule.slotCapacity,
        dailySessionLimit: savedSchedule.dailySessionLimit,
        weeklySchedule: savedSchedule.weeklySchedule,
        courses: savedSchedule.courses
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(savedSchedule);
    expect(Schedule.findOneAndUpdate).toHaveBeenCalledWith(
      { lecturerId: savedSchedule.lecturerId },
      {
        $set: expect.objectContaining({
          lecturerId: savedSchedule.lecturerId,
          lecturerName: savedSchedule.lecturerName,
          staffId: savedSchedule.staffId,
          slotCapacity: savedSchedule.slotCapacity,
          dailySessionLimit: savedSchedule.dailySessionLimit,
          weeklySchedule: savedSchedule.weeklySchedule,
          courses: savedSchedule.courses
        })
      },
      { upsert: true, new: true }
    );
  });
});
