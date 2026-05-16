const express = require('express');
const request = require('supertest');

jest.mock('../../src/models/activity', () => ({
  find: jest.fn(),
  create: jest.fn(),
  deleteMany: jest.fn()
}));

jest.mock('../../src/models/booking', () => ({
  find: jest.fn()
}));

jest.mock('../../src/models/Availability', () => ({
  find: jest.fn()
}));

const Activity = require('../../src/models/activity');
const Booking = require('../../src/models/booking');
const Availability = require('../../src/models/Availability');
const activitiesRouter = require('../../src/routes/activities');

function mockActivityFind(activities) {
  Activity.find.mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue(activities)
    })
  });
}

function mockBookingFind(bookings) {
  Booking.find.mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(bookings)
      })
    })
  });
}

function mockAvailabilityFind(availabilities) {
  Availability.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(availabilities)
  });
}

describe('Activity API', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/activities', activitiesRouter);
  });

  it('limits lecturer activity courses to courses they lecture', async () => {
    mockActivityFind([
      {
        _id: 'activity-1',
        type: 'created',
        description: 'Booked ELEN4010 consultation',
        user: 'student@wits.ac.za',
        userId: 'student@wits.ac.za',
        userEmail: 'student@wits.ac.za',
        userRole: 'student',
        timestamp: '2026-05-16T08:00:00.000Z',
        metadata: {
          course: 'ELEN4010',
          lecturerId: 'lecturer@wits.ac.za',
          lecturerEmail: 'lecturer@wits.ac.za',
          audienceIds: ['lecturer@wits.ac.za'],
          audienceEmails: ['lecturer@wits.ac.za']
        }
      },
      {
        _id: 'activity-2',
        type: 'created',
        description: 'Booked COMS3009 consultation',
        user: 'student@wits.ac.za',
        userId: 'student@wits.ac.za',
        userEmail: 'student@wits.ac.za',
        userRole: 'student',
        timestamp: '2026-05-16T09:00:00.000Z',
        metadata: {
          course: 'COMS3009',
          lecturerId: 'lecturer@wits.ac.za',
          lecturerEmail: 'lecturer@wits.ac.za',
          audienceIds: ['lecturer@wits.ac.za'],
          audienceEmails: ['lecturer@wits.ac.za']
        }
      }
    ]);
    mockBookingFind([]);
    mockAvailabilityFind([
      {
        lecturerEmail: 'lecturer@wits.ac.za',
        courses: ['ELEN4010'],
        weeklySchedule: [
          { dayOfWeek: 1, slots: [{ course: 'ELEN4010', start: '10:00', end: '11:00' }] }
        ]
      }
    ]);

    const response = await request(app)
      .get('/api/activities')
      .set('X-User-Email', 'lecturer@wits.ac.za')
      .set('X-User-Id', 'lecturer@wits.ac.za')
      .set('X-User-Role', 'lecturer');

    expect(response.status).toBe(200);
    expect(response.body.map(activity => activity.metadata.course)).toEqual(['ELEN4010', 'ELEN4010']);
    expect(response.body.map(activity => activity.metadata.course)).not.toContain('COMS3009');
  });

  it('keeps lecturer activity for modules they had past sessions for', async () => {
    mockActivityFind([
      {
        _id: 'activity-1',
        type: 'created',
        description: 'Booked COMS3009 consultation',
        user: 'student@wits.ac.za',
        userId: 'student@wits.ac.za',
        userEmail: 'student@wits.ac.za',
        userRole: 'student',
        timestamp: '2026-05-16T09:00:00.000Z',
        metadata: {
          course: 'COMS3009',
          lecturerId: 'lecturer@wits.ac.za',
          lecturerEmail: 'lecturer@wits.ac.za',
          audienceIds: ['lecturer@wits.ac.za'],
          audienceEmails: ['lecturer@wits.ac.za']
        }
      }
    ]);
    mockBookingFind([
      {
        _id: 'booking-1',
        studentId: 'student@wits.ac.za',
        lecturerId: 'lecturer@wits.ac.za',
        module: 'COMS3009',
        date: '2026-04-10',
        startTime: '10:00',
        endTime: '11:00',
        status: 'completed',
        participantIDs: ['student@wits.ac.za']
      }
    ]);
    mockAvailabilityFind([
      {
        lecturerEmail: 'lecturer@wits.ac.za',
        courses: ['ELEN4010'],
        weeklySchedule: []
      }
    ]);

    const response = await request(app)
      .get('/api/activities')
      .set('X-User-Email', 'lecturer@wits.ac.za')
      .set('X-User-Id', 'lecturer@wits.ac.za')
      .set('X-User-Role', 'lecturer');

    expect(response.status).toBe(200);
    expect(response.body.map(activity => activity.metadata.course)).toContain('COMS3009');
  });
});
