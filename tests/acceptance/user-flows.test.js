const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = require('../../src/app');
const User = require('../../src/models/user');
const Booking = require('../../src/models/booking');
const Schedule = require('../../src/models/Schedule');
const Availability = require('../../src/models/Availability');
const PasswordResetToken = require('../../src/models/passwordResetToken');
const { sendPasswordResetEmail, sendNotification } = require('../../src/utils/emailService');

jest.mock('../../src/models/user');
jest.mock('../../src/models/booking');
jest.mock('../../src/models/Schedule');
jest.mock('../../src/models/Availability');
jest.mock('../../src/models/passwordResetToken');
jest.mock('../../src/utils/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendNotification: jest.fn()
}));

const chainUserLookup = user => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(user)
  })
});

const chainUsersLookup = users => ({
  lean: jest.fn().mockResolvedValue(users)
});

describe('User Acceptance Flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a student to register, log in, book, view, and cancel a consultation', async () => {
    const plainPassword = 'SecurePassword123!';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const student = {
      _id: 'student-1',
      name: 'Jane',
      surname: 'Doe',
      idNumber: '200001',
      email: 'jane@student.wits.ac.za',
      role: 'student',
      password: hashedPassword
    };
    const booking = {
      _id: 'session_123',
      studentId: student.email,
      lecturerId: 'prof@wits.ac.za',
      date: '2026-07-10',
      startTime: '09:30',
      endTime: '10:00',
      module: 'PHYS1000',
      venue: 'Room 101',
      topic: 'First student topic',
      status: 'upcoming'
    };
    const lean = jest.fn().mockResolvedValue([booking]);
    const sort = jest.fn().mockReturnValue({ lean });

    User.findOne
      .mockResolvedValueOnce(null)
      .mockReturnValueOnce(chainUserLookup(student));
    User.find.mockReturnValue(chainUsersLookup([
      { email: booking.lecturerId, name: 'John', surname: 'Smith' }
    ]));
    User.prototype.save = jest.fn().mockResolvedValue(student);
    Booking.countDocuments.mockResolvedValue(0);
    Booking.prototype.save = jest.fn().mockResolvedValue(booking);
    Booking.find.mockReturnValue({ sort });
    Booking.findById.mockResolvedValue(booking);
    Booking.findByIdAndUpdate.mockResolvedValue({ ...booking, status: 'canceled' });

    const registerResponse = await request(app)
      .post('/api/register')
      .send({
        name: student.name,
        surname: student.surname,
        idNumber: student.idNumber,
        email: student.email,
        role: student.role,
        password: plainPassword
      });

    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app)
      .post('/api/login')
      .send({ email: student.email, password: plainPassword });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user).toMatchObject({
      name: student.name,
      surname: student.surname,
      idNumber: student.idNumber,
      role: student.role
    });

    const bookResponse = await request(app)
      .post('/api/bookings/create')
      .send({
        lecturerId: booking.lecturerId,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        module: booking.module,
        venue: booking.venue,
        studentId: student.email,
        topic: booking.topic
      });

    expect(bookResponse.status).toBe(201);
    expect(bookResponse.body.booking).toMatchObject({ _id: booking._id });

    const bookingsResponse = await request(app)
      .get('/api/bookings')
      .query({ studentId: student.email });

    expect(bookingsResponse.status).toBe(200);
    expect(bookingsResponse.body).toEqual([
      { ...booking, lecturerName: 'John Smith' }
    ]);
    expect(Booking.find).toHaveBeenCalledWith({
      $or: [
        { participantIDs: student.email },
        { leftParticipantIDs: student.email }
      ]
    });
    expect(sort).toHaveBeenCalledWith({ date: 1, startTime: 1 });
    expect(lean).toHaveBeenCalled();
    expect(User.find).toHaveBeenCalledWith(
      {
        role: 'lecturer',
        $or: [
          { email: { $in: [booking.lecturerId] } },
          { idNumber: { $in: [booking.lecturerId] } }
        ]
      },
      'name surname email idNumber'
    );

    const cancelResponse = await request(app)
      .delete(`/api/bookings/${booking._id}`)
      .send({ studentEmail: student.email });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.message).toContain('successfully canceled');
    expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(booking._id, { status: 'canceled' });
  });

  it('allows a lecturer to save and reload their weekly consultation schedule', async () => {
    const savedSchedule = {
      lecturerId: 'lecturer@wits.ac.za',
      lecturerName: 'Prof Smith',
      staffId: 'STAFF123',
      slotCapacity: 3,
      dailySessionLimit: 6,
      courses: ['ELEN4010'],
      weeklySchedule: [
        { dayOfWeek: 2, slots: [{ start: '10:00', end: '12:00' }] }
      ]
    };

    Schedule.findOneAndUpdate.mockResolvedValue(savedSchedule);
    Schedule.findOne.mockResolvedValue(savedSchedule);

    const saveResponse = await request(app)
      .post('/api/schedules')
      .set('X-Lecturer-Id', savedSchedule.lecturerId)
      .set('X-Lecturer-Name', savedSchedule.lecturerName)
      .send({
        staffId: savedSchedule.staffId,
        slotCapacity: savedSchedule.slotCapacity,
        dailySessionLimit: savedSchedule.dailySessionLimit,
        courses: savedSchedule.courses,
        weeklySchedule: savedSchedule.weeklySchedule
      });

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.message).toBe('Schedule saved');
    expect(Schedule.findOneAndUpdate).toHaveBeenCalledWith(
      { lecturerId: savedSchedule.lecturerId },
      {
        $set: expect.objectContaining({
          lecturerId: savedSchedule.lecturerId,
          lecturerName: savedSchedule.lecturerName,
          staffId: savedSchedule.staffId,
          slotCapacity: savedSchedule.slotCapacity,
          dailySessionLimit: savedSchedule.dailySessionLimit,
          courses: savedSchedule.courses,
          weeklySchedule: savedSchedule.weeklySchedule
        })
      },
      { upsert: true, new: true }
    );

    const loadResponse = await request(app)
      .get('/api/schedules')
      .set('X-Lecturer-Id', savedSchedule.lecturerId);

    expect(loadResponse.status).toBe(200);
    expect(loadResponse.body).toMatchObject({
      lecturerName: savedSchedule.lecturerName,
      staffId: savedSchedule.staffId,
      slotCapacity: savedSchedule.slotCapacity,
      dailySessionLimit: savedSchedule.dailySessionLimit,
      weeklySchedule: savedSchedule.weeklySchedule,
      courses: savedSchedule.courses
    });
  });

  it('allows a student to see available consultation blocks before booking', async () => {
    const availability = {
      lecturerEmail: 'lecturer@wits.ac.za',
      weeklySchedule: [
        { dayOfWeek: 2, slots: [{ start: '10:00', end: '11:00', duration: 30, venue: 'Room 101' }] }
      ]
    };

    Availability.findOne.mockResolvedValue(availability);
    Booking.find.mockResolvedValue([
      { startTime: '10:00', status: 'upcoming' }
    ]);

    const response = await request(app)
      .get('/api/bookings/availability')
      .query({
        lecturerId: availability.lecturerEmail,
        date: '2026-05-05'
      });

    expect(response.status).toBe(200);
    expect(response.body.availableBlocks).toEqual(availability.weeklySchedule[0].slots);
    expect(response.body.bookedTimes).toEqual(['10:00']);
    expect(Availability.findOne).toHaveBeenCalledWith({ lecturerEmail: availability.lecturerEmail });
    expect(Booking.find).toHaveBeenCalledWith({
      lecturerId: availability.lecturerEmail,
      date: '2026-05-05',
      status: { $ne: 'canceled' }
    });
  });

  it('allows a user to reset their password and then log in with the new password', async () => {
    const email = 'jane@student.wits.ac.za';
    const resetToken = 'raw-reset-token';
    const newPassword = 'BrandNew123!';
    const resetRecord = { used: false, save: jest.fn().mockResolvedValue(true) };
    const user = {
      _id: 'student-1',
      name: 'Jane',
      surname: 'Doe',
      idNumber: '200001',
      email,
      role: 'student',
      password: 'old-hash',
      save: jest.fn().mockResolvedValue(true)
    };

    User.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(user)
      .mockImplementationOnce(() => chainUserLookup(user));
    PasswordResetToken.deleteMany.mockResolvedValue({});
    PasswordResetToken.create.mockResolvedValue({});
    PasswordResetToken.findOne.mockResolvedValue(resetRecord);

    const forgotResponse = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email });

    expect(forgotResponse.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(email, expect.stringContaining('/reset-password.html?token='));

    const resetResponse = await request(app)
      .post('/api/auth/reset-password')
      .send({ email, token: resetToken, newPassword });

    const expectedHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    expect(resetResponse.status).toBe(200);
    expect(PasswordResetToken.findOne).toHaveBeenCalledWith(expect.objectContaining({
      userId: user._id,
      tokenHash: expectedHash,
      used: false
    }));
    expect(resetRecord.used).toBe(true);
    expect(await bcrypt.compare(newPassword, user.password)).toBe(true);
    expect(sendNotification).toHaveBeenCalledWith(user, expect.any(String), expect.any(String));

    const loginResponse = await request(app)
      .post('/api/login')
      .send({ email, password: newPassword });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user).toMatchObject({
      name: user.name,
      surname: user.surname,
      idNumber: user.idNumber,
      role: user.role
    });
  });
});
