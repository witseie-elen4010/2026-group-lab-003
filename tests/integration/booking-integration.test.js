const request = require('supertest');

jest.mock('../../src/models/booking', () => {
  const save = jest.fn();
  const Booking = jest.fn(function Booking(data) {
    Object.assign(this, data);
    this.save = save;
  });

  Booking.countDocuments = jest.fn();
  Booking.find = jest.fn();
  Booking.findById = jest.fn();
  Booking.findByIdAndUpdate = jest.fn();
  Booking.updateMany = jest.fn();
  Booking.prototype.save = save;

  return Booking;
});

jest.mock('../../src/models/Availability', () => ({
  findOne: jest.fn()
}));

const app = require('../../src/app');
const Booking = require('../../src/models/booking');
const Availability = require('../../src/models/Availability');

describe('Booking Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes validation and saves a booking through the mounted route', async () => {
    const bookingRequest = {
      lecturerId: 'lecturer@wits.ac.za',
      date: '2026-06-01',
      startTime: '10:00',
      endTime: '11:00',
      module: 'ELEN4010',
      studentId: 'student@wits.ac.za',
      topic: 'First student topic'
    };
    const savedBooking = { _id: 'mock_id', ...bookingRequest, status: 'upcoming' };

    Booking.countDocuments.mockResolvedValue(0);
    Booking.prototype.save.mockResolvedValue(savedBooking);

    const response = await request(app)
      .post('/api/bookings/create')
      .send(bookingRequest);

    expect(response.status).toBe(201);
    expect(response.body.booking).toMatchObject(savedBooking);
    expect(Booking.countDocuments).toHaveBeenNthCalledWith(1, {
      lecturerId: bookingRequest.lecturerId,
      date: bookingRequest.date,
      startTime: bookingRequest.startTime,
      endTime: bookingRequest.endTime,
      status: { $ne: 'canceled' }
    });
    expect(Booking.countDocuments).toHaveBeenNthCalledWith(2, {
      lecturerId: bookingRequest.lecturerId,
      date: bookingRequest.date,
      status: { $ne: 'canceled' }
    });
    expect(Booking).toHaveBeenCalledWith(expect.objectContaining({
      ...bookingRequest,
      status: 'upcoming'
    }));
    expect(Booking.prototype.save).toHaveBeenCalled();
  });

  it('requires a topic when creating a booking', async () => {
    Booking.countDocuments.mockResolvedValue(0);

    const response = await request(app)
      .post('/api/bookings/create')
      .send({
        lecturerId: 'lecturer@wits.ac.za',
        date: '2026-06-01',
        startTime: '10:00',
        endTime: '11:00',
        module: 'ELEN4010',
        studentId: 'student@wits.ac.za'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Topic is required');
    expect(Booking.prototype.save).not.toHaveBeenCalled();
  });

  it('rejects invalid booking requests before saving', async () => {
    const response = await request(app)
      .post('/api/bookings/create')
      .send({
        lecturerId: 'lecturer@wits.ac.za',
        date: '2026-06-01',
        startTime: '10:00'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Missing required fields');
    expect(Booking.prototype.save).not.toHaveBeenCalled();
  });

  it('returns available blocks and booked times for a lecturer and date', async () => {
    Availability.findOne.mockResolvedValue({
      lecturerEmail: 'lecturer@wits.ac.za',
      weeklySchedule: [
        { dayOfWeek: 1, slots: [{ start: '09:00', end: '10:00', duration: 30 }] }
      ]
    });
    Booking.find.mockResolvedValue([
      { startTime: '09:00', status: 'upcoming' }
    ]);

    const response = await request(app)
      .get('/api/bookings/availability')
      .query({
        lecturerId: 'lecturer@wits.ac.za',
        date: '2026-06-01'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      availableBlocks: [{ start: '09:00', end: '10:00', duration: 30 }],
      bookedTimes: ['09:00']
    });
    expect(Availability.findOne).toHaveBeenCalledWith({ lecturerEmail: 'lecturer@wits.ac.za' });
    expect(Booking.find).toHaveBeenCalledWith({
      lecturerId: 'lecturer@wits.ac.za',
      date: '2026-06-01',
      status: { $ne: 'canceled' }
    });
  });

  it('returns an empty availability response when the lecturer has no slots that day', async () => {
    Availability.findOne.mockResolvedValue({
      lecturerEmail: 'lecturer@wits.ac.za',
      weeklySchedule: [
        { dayOfWeek: 2, slots: [{ start: '09:00', end: '10:00' }] }
      ]
    });

    const response = await request(app)
      .get('/api/bookings/availability')
      .query({
        lecturerId: 'lecturer@wits.ac.za',
        date: '2026-06-01'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Lecturer is not available on this day.',
      availableBlocks: [],
      bookedTimes: []
    });
    expect(Booking.find).not.toHaveBeenCalled();
  });

  it('returns 404 when lecturer availability does not exist', async () => {
    Availability.findOne.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/bookings/availability')
      .query({
        lecturerId: 'missing@wits.ac.za',
        date: '2026-06-01'
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Lecturer availability not found.');
  });

  it('requires a studentId when listing student bookings', async () => {
    const response = await request(app).get('/api/bookings');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Student ID is required.');
    expect(Booking.find).not.toHaveBeenCalled();
  });

  it('returns sorted bookings for the requested student', async () => {
    const bookings = [
      {
        _id: 'b1',
        studentId: 'student@wits.ac.za',
        participantIDs: ['student@wits.ac.za'],
        leftParticipantIDs: [],
        date: '2026-06-01',
        startTime: '10:00'
      }
    ];
    const lean = jest.fn().mockResolvedValue(bookings);
    const sort = jest.fn().mockReturnValue({ lean });
    Booking.find.mockReturnValue({ sort });

    const response = await request(app)
      .get('/api/bookings')
      .query({ studentId: 'student@wits.ac.za' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(bookings);
    expect(Booking.find).toHaveBeenCalledWith({
      $or: [
        { participantIDs: 'student@wits.ac.za' },
        { leftParticipantIDs: 'student@wits.ac.za' }
      ]
    });
    expect(sort).toHaveBeenCalledWith({ date: 1, startTime: 1 });
    expect(lean).toHaveBeenCalled();
  });

  it('soft-cancels a booking when the requester owns it', async () => {
    Booking.findById.mockResolvedValue({
      _id: 'session_123',
      studentId: 'student@wits.ac.za'
    });
    Booking.findByIdAndUpdate.mockResolvedValue({ status: 'canceled' });

    const response = await request(app)
      .delete('/api/bookings/session_123')
      .send({ studentEmail: 'student@wits.ac.za' });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('successfully canceled');
    expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith('session_123', { status: 'canceled' });
  });

  it('blocks a student from canceling another student booking', async () => {
    Booking.findById.mockResolvedValue({
      _id: 'session_123',
      studentId: 'owner@wits.ac.za'
    });

    const response = await request(app)
      .delete('/api/bookings/session_123')
      .send({ studentEmail: 'other@wits.ac.za' });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Unauthorized');
    expect(Booking.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('cancels every booking in a grouped lecturer session', async () => {
    Booking.updateMany.mockResolvedValue({ modifiedCount: 2 });

    const response = await request(app)
      .put('/api/bookings/session/cancel')
      .send({ bookingIds: ['booking-1', 'booking-2'] });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      modifiedCount: 2
    });
    expect(Booking.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['booking-1', 'booking-2'] } },
      { $set: { status: 'canceled' } }
    );
  });
});
