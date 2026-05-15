const request = require('supertest');

jest.mock('../../src/models/Schedule', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

const app = require('../../src/app');
const Schedule = require('../../src/models/Schedule');

describe('Lecturer Schedule API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects schedule reads when X-Lecturer-Id is missing', async () => {
    const response = await request(app).get('/api/schedules');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
    expect(Schedule.findOne).not.toHaveBeenCalled();
  });

  it('returns default schedule data when the lecturer has not saved availability yet', async () => {
    Schedule.findOne.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/schedules')
      .set('X-Lecturer-Id', 'lecturer-123');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      slotCapacity: 1,
      dailySessionLimit: 10,
      weeklySchedule: [],
      courses: []
    });
  });

  it('saves a valid lecturer schedule', async () => {
    const savedSchedule = {
      lecturerId: 'lecturer-123',
      lecturerName: 'Test Lecturer',
      staffId: 'STAFF123',
      slotCapacity: 2,
      dailySessionLimit: 6,
      weeklySchedule: [
        { dayOfWeek: 1, slots: [{ start: '09:00', end: '10:00' }] }
      ],
      courses: ['ELEN4010']
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
    expect(response.body.message).toBe('Schedule saved');
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
