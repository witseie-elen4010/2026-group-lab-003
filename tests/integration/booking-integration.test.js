const request = require('supertest')

jest.mock('../../src/models/booking', () => {
  const save = jest.fn()
  const Booking = jest.fn(function Booking (data) {
    Object.assign(this, data)
    this.save = save
  })

  Booking.countDocuments = jest.fn()
  Booking.find = jest.fn()
  Booking.findById = jest.fn()
  Booking.findByIdAndUpdate = jest.fn()
  Booking.updateMany = jest.fn()
  Booking.prototype.save = save

  return Booking
})

jest.mock('../../src/models/Availability', () => ({
  findOne: jest.fn()
}))

jest.mock('../../src/models/user', () => ({
  findOne: jest.fn(),
  find: jest.fn()
}))

jest.mock('../../src/utils/emailService', () => ({
  sendNotification: jest.fn()
}))

jest.mock('../../src/models/activity', () => ({
  create: jest.fn()
}))

const app = require('../../src/app')
const Booking = require('../../src/models/booking')
const Availability = require('../../src/models/Availability')
const User = require('../../src/models/user')
const Activity = require('../../src/models/activity')
const { sendNotification } = require('../../src/utils/emailService')

describe('Booking Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes validation and saves a booking through the mounted route', async () => {
    const bookingRequest = {
      lecturerId: 'lecturer@wits.ac.za',
      date: '2026-06-01',
      startTime: '10:00',
      endTime: '11:00',
      module: 'ELEN4010',
      venue: 'Room 101',
      studentId: 'student@wits.ac.za',
      topic: 'First student topic'
    }
    const savedBooking = { _id: 'mock_id', ...bookingRequest, status: 'upcoming' }

    Booking.countDocuments.mockResolvedValue(0)
    Booking.prototype.save.mockResolvedValue(savedBooking)
    User.findOne.mockResolvedValueOnce({
      name: 'Jane',
      email: 'jane.in.database@wits.ac.za',
      role: 'student',
      emailNotifications: true
    }).mockResolvedValueOnce({
      name: 'Stephen',
      surname: 'Mokoena',
      email: 'lecturer@wits.ac.za',
      role: 'lecturer',
      emailNotifications: true
    })

    const response = await request(app)
      .post('/api/bookings/create')
      .send(bookingRequest)

    expect(response.status).toBe(201)
    expect(response.body.booking).toMatchObject(savedBooking)
    expect(Booking.countDocuments).toHaveBeenNthCalledWith(1, {
      lecturerId: bookingRequest.lecturerId,
      date: bookingRequest.date,
      startTime: bookingRequest.startTime,
      endTime: bookingRequest.endTime,
      status: { $ne: 'canceled' }
    })
    expect(Booking.countDocuments).toHaveBeenNthCalledWith(2, {
      lecturerId: bookingRequest.lecturerId,
      date: bookingRequest.date,
      status: { $ne: 'canceled' }
    })
    expect(Booking).toHaveBeenCalledWith(expect.objectContaining({
      ...bookingRequest,
      status: 'upcoming'
    }))
    expect(Booking.prototype.save).toHaveBeenCalled()
    expect(User.findOne).toHaveBeenCalledWith({
      $or: [
        { email: bookingRequest.studentId },
        { idNumber: bookingRequest.studentId }
      ],
      role: 'student'
    })
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane.in.database@wits.ac.za' }),
      'Consultation booking confirmed',
      expect.stringContaining('ELEN4010')
    )
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'lecturer@wits.ac.za' }),
      'New consultation booking',
      expect.stringContaining('Jane has booked one of your consultation slots.')
    )
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'lecturer@wits.ac.za' }),
      'New consultation booking',
      expect.stringContaining('You can view this booking from your lecturer dashboard.')
    )
  })

  it('requires a topic when creating a booking', async () => {
    Booking.countDocuments.mockResolvedValue(0)

    const response = await request(app)
      .post('/api/bookings/create')
      .send({
        lecturerId: 'lecturer@wits.ac.za',
        date: '2026-06-01',
        startTime: '10:00',
        endTime: '11:00',
        module: 'ELEN4010',
        studentId: 'student@wits.ac.za'
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Topic is required')
    expect(Booking.prototype.save).not.toHaveBeenCalled()
  })

  it('rejects invalid booking requests before saving', async () => {
    const response = await request(app)
      .post('/api/bookings/create')
      .send({
        lecturerId: 'lecturer@wits.ac.za',
        date: '2026-06-01',
        startTime: '10:00'
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.message).toContain('Missing required fields')
    expect(Booking.prototype.save).not.toHaveBeenCalled()
  })

  it('returns available blocks and booked times for a lecturer and date', async () => {
    Availability.findOne.mockResolvedValue({
      lecturerEmail: 'lecturer@wits.ac.za',
      weeklySchedule: [
        { dayOfWeek: 1, slots: [{ start: '09:00', end: '10:00', duration: 30, venue: 'Room 101' }] }
      ]
    })
    Booking.find.mockResolvedValue([
      { startTime: '09:00', status: 'upcoming' }
    ])

    const response = await request(app)
      .get('/api/bookings/availability')
      .query({
        lecturerId: 'lecturer@wits.ac.za',
        date: '2026-06-01'
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      availableBlocks: [{ start: '09:00', end: '10:00', duration: 30, venue: 'Room 101' }],
      bookedTimes: ['09:00']
    })
    expect(Availability.findOne).toHaveBeenCalledWith({ lecturerEmail: 'lecturer@wits.ac.za' })
    expect(Booking.find).toHaveBeenCalledWith({
      lecturerId: 'lecturer@wits.ac.za',
      date: '2026-06-01',
      status: { $ne: 'canceled' }
    })
  })

  it('returns an empty availability response when the lecturer has no slots that day', async () => {
    Availability.findOne.mockResolvedValue({
      lecturerEmail: 'lecturer@wits.ac.za',
      weeklySchedule: [
        { dayOfWeek: 2, slots: [{ start: '09:00', end: '10:00' }] }
      ]
    })

    const response = await request(app)
      .get('/api/bookings/availability')
      .query({
        lecturerId: 'lecturer@wits.ac.za',
        date: '2026-06-01'
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      message: 'Lecturer is not available on this day.',
      availableBlocks: [],
      bookedTimes: []
    })
    expect(Booking.find).not.toHaveBeenCalled()
  })

  it('returns 404 when lecturer availability does not exist', async () => {
    Availability.findOne.mockResolvedValue(null)

    const response = await request(app)
      .get('/api/bookings/availability')
      .query({
        lecturerId: 'missing@wits.ac.za',
        date: '2026-06-01'
      })

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('Lecturer availability not found.')
  })

  it('requires a studentId when listing student bookings', async () => {
    const response = await request(app).get('/api/bookings')

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Student ID is required.')
    expect(Booking.find).not.toHaveBeenCalled()
  })

  it('returns upcoming peer sessions when listing by status without a studentId', async () => {
    const bookings = [
      {
        _id: 'b1',
        studentId: 'owner@wits.ac.za',
        lecturerId: 'lecturer@wits.ac.za',
        participantIDs: ['owner@wits.ac.za'],
        date: '2026-06-01',
        startTime: '10:00',
        endTime: '11:00',
        module: 'ELEN50',
        status: 'upcoming'
      }
    ]
    const lean = jest.fn().mockResolvedValue(bookings)
    const sort = jest.fn().mockReturnValue({ lean })
    Booking.find.mockReturnValue({ sort })
    Availability.findOne.mockResolvedValue({
      weeklySchedule: [
        {
          dayOfWeek: 1,
          slots: [
            {
              start: '10:00',
              end: '11:00',
              course: 'ELEN50',
              maxStudents: 10
            }
          ]
        }
      ]
    })

    const response = await request(app)
      .get('/api/bookings')
      .query({ status: 'upcoming,ongoing' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      {
        ...bookings[0],
        maxStudents: 10,
        spacesLeft: 9
      }
    ])
    expect(Booking.find).toHaveBeenCalledWith({
      status: { $in: ['upcoming', 'ongoing'] }
    })
    expect(sort).toHaveBeenCalledWith({ date: 1, startTime: 1 })
    expect(lean).toHaveBeenCalled()
    expect(Availability.findOne).toHaveBeenCalledWith({ lecturerEmail: 'lecturer@wits.ac.za' })
    expect(User.find).not.toHaveBeenCalled()
  })

  it('allows students to join while the matching availability slot still has space', async () => {
    const participantIDs = Array.from({ length: 9 }, (_, index) => `student${index}@wits.ac.za`)
    Booking.findById.mockResolvedValue({
      _id: 'booking-1',
      lecturerId: 'lecturer@wits.ac.za',
      date: '2026-06-01',
      startTime: '10:00',
      endTime: '11:00',
      module: 'ELEN50',
      maxStudents: 1,
      participantIDs
    })
    Availability.findOne.mockResolvedValue({
      weeklySchedule: [
        {
          dayOfWeek: 1,
          slots: [
            {
              start: '10:00',
              end: '11:00',
              course: 'ELEN50',
              maxStudents: 10
            }
          ]
        }
      ]
    })
    Booking.findByIdAndUpdate.mockResolvedValue({})
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          email: 'newstudent@wits.ac.za',
          name: 'New',
          surname: 'Student',
          role: 'student',
          emailNotifications: true
        }
      ])
    })
    User.findOne.mockResolvedValue({
      email: 'lecturer@wits.ac.za',
      name: 'Jane',
      surname: 'Smith',
      role: 'lecturer',
      emailNotifications: true
    })

    const response = await request(app)
      .put('/api/bookings/booking-1/join')
      .send({ email: 'newstudent@wits.ac.za' })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith('booking-1', {
      $addToSet: { participantIDs: 'newstudent@wits.ac.za' },
      $pull: { leftParticipantIDs: 'newstudent@wits.ac.za' }
    })
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'newstudent@wits.ac.za' }),
      'You joined a consultation',
      expect.stringContaining('You have successfully joined this consultation.')
    )
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'lecturer@wits.ac.za' }),
      'Student joined your consultation',
      expect.stringContaining('New Student has joined your consultation.')
    )
    expect(Activity.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'joined',
      description: 'Joined ELEN50 consultation',
      user: 'newstudent@wits.ac.za',
      userId: 'newstudent@wits.ac.za',
      userEmail: 'newstudent@wits.ac.za',
      userRole: 'student',
      metadata: expect.objectContaining({
        actorId: 'newstudent@wits.ac.za',
        actorEmail: 'newstudent@wits.ac.za',
        studentId: undefined,
        lecturerId: 'lecturer@wits.ac.za',
        audienceIds: expect.arrayContaining(['lecturer@wits.ac.za', 'newstudent@wits.ac.za']),
        audienceEmails: expect.arrayContaining(['lecturer@wits.ac.za', 'newstudent@wits.ac.za'])
      })
    }))
  })

  it('notifies the lecturer when a student joins a session stored under a lecturer number', async () => {
    Booking.findById.mockResolvedValue({
      _id: 'booking-2',
      lecturerId: '2540701',
      studentId: 'owner@wits.ac.za',
      date: '2026-06-01',
      startTime: '10:00',
      endTime: '11:00',
      module: 'ELEN50',
      maxStudents: 10,
      participantIDs: ['owner@wits.ac.za']
    })
    Availability.findOne.mockResolvedValue({
      weeklySchedule: [
        {
          dayOfWeek: 1,
          slots: [{ start: '10:00', end: '11:00', course: 'ELEN50', maxStudents: 10 }]
        }
      ]
    })
    Booking.findByIdAndUpdate.mockResolvedValue({})
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          email: 'newstudent@wits.ac.za',
          name: 'New',
          surname: 'Student',
          role: 'student',
          emailNotifications: true
        }
      ])
    })
    User.findOne.mockResolvedValue({
      email: 'lecturer@wits.ac.za',
      idNumber: '2540701',
      name: 'Jane',
      surname: 'Smith',
      role: 'lecturer',
      emailNotifications: true
    })

    const response = await request(app)
      .put('/api/bookings/booking-2/join')
      .send({ email: 'newstudent@wits.ac.za' })

    expect(response.status).toBe(200)
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'lecturer@wits.ac.za' }),
      'Student joined your consultation',
      expect.stringContaining('New Student has joined your consultation.')
    )
    expect(User.findOne).toHaveBeenCalledWith({
      role: 'lecturer',
      $or: [
        { email: '2540701' },
        { idNumber: '2540701' },
        { idNumber: 2540701 }
      ]
    })
  })

  it('returns sorted bookings for the requested student', async () => {
    const bookings = [
      {
        _id: 'b1',
        studentId: 'student@wits.ac.za',
        lecturerId: 'lecturer@wits.ac.za',
        participantIDs: ['student@wits.ac.za'],
        leftParticipantIDs: [],
        date: '2026-06-01',
        startTime: '10:00'
      }
    ]
    const lean = jest.fn().mockResolvedValue(bookings)
    const sort = jest.fn().mockReturnValue({ lean })
    Booking.find.mockReturnValue({ sort })
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { email: 'lecturer@wits.ac.za', name: 'Jane', surname: 'Smith' }
      ])
    })

    const response = await request(app)
      .get('/api/bookings')
      .query({ studentId: 'student@wits.ac.za' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { ...bookings[0], lecturerName: 'Jane Smith' }
    ])
    expect(Booking.find).toHaveBeenCalledWith({
      $or: [
        { participantIDs: 'student@wits.ac.za' },
        { leftParticipantIDs: 'student@wits.ac.za' }
      ]
    })
    expect(sort).toHaveBeenCalledWith({ date: 1, startTime: 1 })
    expect(lean).toHaveBeenCalled()
    expect(User.find).toHaveBeenCalledWith(
      {
        role: 'lecturer',
        $or: [
          { email: { $in: ['lecturer@wits.ac.za'] } },
          { idNumber: { $in: ['lecturer@wits.ac.za'] } }
        ]
      },
      'name surname email idNumber'
    )
  })

  it('returns lecturer names when student bookings store a lecturer id number', async () => {
    const bookings = [
      {
        _id: 'b1',
        studentId: 'student@wits.ac.za',
        lecturerId: '2540701',
        participantIDs: ['student@wits.ac.za'],
        leftParticipantIDs: [],
        date: '2026-06-01',
        startTime: '10:00'
      }
    ]
    const lean = jest.fn().mockResolvedValue(bookings)
    const sort = jest.fn().mockReturnValue({ lean })
    Booking.find.mockReturnValue({ sort })
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { idNumber: '2540701', email: 'lecturer@wits.ac.za', name: 'Jane', surname: 'Smith' }
      ])
    })

    const response = await request(app)
      .get('/api/bookings')
      .query({ studentId: 'student@wits.ac.za' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { ...bookings[0], lecturerName: 'Jane Smith' }
    ])
    expect(User.find).toHaveBeenCalledWith(
      {
        role: 'lecturer',
        $or: [
          { email: { $in: ['2540701'] } },
          { idNumber: { $in: ['2540701'] } }
        ]
      },
      'name surname email idNumber'
    )
  })

  it('returns a rejoined student booking as active when the student is also in leftParticipantIDs', async () => {
    const bookings = [
      {
        _id: 'b1',
        studentId: 'owner@wits.ac.za',
        lecturerId: 'lecturer@wits.ac.za',
        participantIDs: ['owner@wits.ac.za', 'student@wits.ac.za'],
        leftParticipantIDs: ['student@wits.ac.za'],
        date: '2026-06-01',
        startTime: '10:00',
        status: 'upcoming'
      }
    ]
    const lean = jest.fn().mockResolvedValue(bookings)
    const sort = jest.fn().mockReturnValue({ lean })
    Booking.find.mockReturnValue({ sort })
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { email: 'lecturer@wits.ac.za', name: 'Jane', surname: 'Smith' }
      ])
    })

    const response = await request(app)
      .get('/api/bookings')
      .query({ studentId: 'student@wits.ac.za' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { ...bookings[0], lecturerName: 'Jane Smith' }
    ])
  })

  it('returns formatted student names for lecturer bookings', async () => {
    const bookings = [
      {
        _id: 'booking-1',
        studentId: 'student@wits.ac.za',
        lecturerId: '2540701',
        participantIDs: ['student@wits.ac.za'],
        date: '2026-06-01',
        startTime: '10:00',
        endTime: '11:00',
        module: 'ELEN4010'
      }
    ]
    const sort = jest.fn().mockResolvedValue(bookings)
    Booking.find.mockReturnValue({ sort })
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          email: 'student@wits.ac.za',
          name: 'Nkosinathi',
          surname: 'Mjiyako',
          idNumber: '2357649'
        }
      ])
    })

    const response = await request(app)
      .get('/api/bookings/lecturer/bookings')
      .query({ email: '2540701' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      {
        ...bookings[0],
        studentName: 'N.Mjiyako-2357649',
        participantNames: ['N.Mjiyako-2357649']
      }
    ])
    expect(Booking.find).toHaveBeenCalledWith({ lecturerId: '2540701' })
    expect(sort).toHaveBeenCalledWith({ date: 1, startTime: 1 })
    expect(User.find).toHaveBeenCalledWith(
      {
        $or: [
          { email: { $in: ['student@wits.ac.za'] } },
          { idNumber: { $in: ['student@wits.ac.za'] } }
        ]
      },
      'name surname displayName idNumber email'
    )
  })

  it('soft-cancels a booking when the requester owns it', async () => {
    Booking.findById.mockResolvedValue({
      _id: 'session_123',
      studentId: 'student@wits.ac.za',
      lecturerId: 'lecturer@wits.ac.za',
      module: 'ELEN4010',
      date: '2026-06-01',
      startTime: '10:00',
      endTime: '11:00',
      participantIDs: undefined
    })
    Booking.findByIdAndUpdate.mockResolvedValue({ status: 'canceled' })
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          email: 'student@wits.ac.za',
          name: 'Jane',
          role: 'student',
          emailNotifications: true
        }
      ])
    })
    User.findOne.mockResolvedValue({
      email: 'lecturer@wits.ac.za',
      name: 'Jane',
      role: 'lecturer',
      emailNotifications: true
    })

    const response = await request(app)
      .delete('/api/bookings/session_123')
      .send({ studentEmail: 'student@wits.ac.za' })

    expect(response.status).toBe(200)
    expect(response.body.message).toContain('successfully canceled')
    expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith('session_123', { status: 'canceled' })
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'student@wits.ac.za' }),
      'Consultation booking canceled',
      expect.stringContaining('Your consultation booking has been canceled.')
    )
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'lecturer@wits.ac.za' }),
      'Student canceled a consultation',
      expect.stringContaining('Jane has canceled this consultation.')
    )
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'lecturer@wits.ac.za' }),
      'Student canceled a consultation',
      expect.stringContaining('You can view the updated session from your lecturer dashboard.')
    )
  })

  it('blocks a student from canceling another student booking', async () => {
    Booking.findById.mockResolvedValue({
      _id: 'session_123',
      studentId: 'owner@wits.ac.za'
    })

    const response = await request(app)
      .delete('/api/bookings/session_123')
      .send({ studentEmail: 'other@wits.ac.za' })

    expect(response.status).toBe(403)
    expect(response.body.message).toContain('Unauthorized')
    expect(Booking.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('cancels every booking in a grouped lecturer session', async () => {
    Booking.updateMany.mockResolvedValue({ modifiedCount: 2 })
    Booking.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: 'booking-1',
          studentId: 'alice@wits.ac.za',
          participantIDs: ['alice@wits.ac.za'],
          module: 'ELEN4010',
          date: '2026-06-01',
          startTime: '10:00',
          endTime: '11:00'
        },
        {
          _id: 'booking-2',
          studentId: 'bob@wits.ac.za',
          participantIDs: ['bob@wits.ac.za'],
          module: 'ELEN4010',
          date: '2026-06-01',
          startTime: '10:00',
          endTime: '11:00'
        }
      ])
    })
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { email: 'alice@wits.ac.za', name: 'Alice', role: 'student', emailNotifications: true },
        { email: 'bob@wits.ac.za', name: 'Bob', role: 'student', emailNotifications: true }
      ])
    })

    const response = await request(app)
      .put('/api/bookings/session/cancel')
      .send({ bookingIds: ['booking-1', 'booking-2'] })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      success: true,
      modifiedCount: 2
    })
    expect(Booking.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['booking-1', 'booking-2'] } },
      { $set: { status: 'canceled' } }
    )
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@wits.ac.za' }),
      'Consultation canceled by lecturer',
      expect.stringContaining('Your lecturer has canceled this consultation.')
    )
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'bob@wits.ac.za' }),
      'Consultation canceled by lecturer',
      expect.stringContaining('Your lecturer has canceled this consultation.')
    )
  })
})
