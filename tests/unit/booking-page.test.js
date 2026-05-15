const request = require('supertest')
const express = require('express')

// 1. MOCK FIRST! Tell Jest to intercept these before the router loads.
jest.mock('../../src/models/booking')
jest.mock('../../src/models/Schedule')

// 2. NOW import your router and models
const bookingsRouter = require('../../src/routes/bookings')
const Booking = require('../../src/models/booking')
const Schedule = require('../../src/models/Schedule')

// 3. Set up the fake Express app
const app = express()
app.use(express.json())
app.use(bookingsRouter)

describe('Booking API Routes', () => {
  // Clear our fake database history after every test
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/bookings', () => {
    it('should successfully create a new booking with a studentId', async () => {
      // Arrange
      Booking.prototype.save = jest.fn().mockResolvedValue(true)

      const newBookingData = {
        studentId: 'fntstembe@gmail.com',
        lecturerId: 'lecturer_1',
        date: '2026-05-10',
        startTime: '10:00',
        endTime: '10:30',
        module: 'CS101'
      }

      // Act
      const response = await request(app)
        .post('/')
        .send(newBookingData)

      // Assert
      expect(response.status).toBe(201)
      expect(response.body.message).toBe('Booking successful!')
      expect(Booking.prototype.save).toHaveBeenCalledTimes(1)
    })
  })

  describe('GET /api/bookings', () => {
    it('should ignore canceled bookings when checking availability', async () => {
      // Arrange: Fake the responses for our database queries
      Schedule.findOne.mockResolvedValue({
        lecturerId: 'test@lecturer.com',
        weeklySchedule: [{
          dayOfWeek: 2, // Tuesday
          slots: [{ start: '10:00', end: '10:30' }]
        }]
      })

      Booking.find.mockResolvedValue([
        { startTime: '10:00', status: 'upcoming' }
      ])

      // Act: Request slots for a Tuesday
      const response = await request(app)
        .get('/availability?lecturerId=test@lecturer.com&date=2026-05-05')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.bookedTimes).toContain('10:00')
      expect(response.body.availableBlocks).toEqual([{ start: '10:00', end: '10:30' }])

      // Prove that it specifically asked Mongoose to ignore 'canceled' bookings!
      expect(Booking.find).toHaveBeenCalledWith({
        lecturerId: 'test@lecturer.com',
        date: '2026-05-05',
        status: { $ne: 'canceled' }
      })
    })
  })

  const request = require('supertest')
  const express = require('express')

  // 1. MOCK FIRST! Tell Jest to intercept these before the router loads.
  jest.mock('../../src/models/booking')
  jest.mock('../../src/models/Availability')

  // Mock the middleware so it doesn't block our route testing
  jest.mock('../../src/middleware/booking-validator', () => ({
    validateLecturerHours: (req, res, next) => next()
  }))

  // 2. NOW import your router and models
  const bookingsRouter = require('../../src/routes/bookings')
  const Booking = require('../../src/models/booking')
  const Availability = require('../../src/models/Availability')

  // 3. Set up the fake Express app
  const app = express()
  app.use(express.json())
  app.use(bookingsRouter) // Mounted at root based on your setup

  describe('Booking API Routes', () => {
  // Clear our fake database history after every test
    afterEach(() => {
      jest.clearAllMocks()
    })

    // EXISTING + ENHANCED: POST /
    describe('POST /', () => {
      it('should successfully create a new booking with a studentId and default arrays', async () => {
      // Arrange
        Booking.prototype.save = jest.fn().mockResolvedValue(true)

        const newBookingData = {
          studentId: 'fntstembe@gmail.com',
          lecturerId: 'lecturer_1',
          date: '2026-05-10',
          startTime: '10:00',
          endTime: '10:30',
          module: 'CS101'
        }

        // Act
        const response = await request(app)
          .post('/')
          .send(newBookingData)

        // Assert
        expect(response.status).toBe(201)
        expect(response.body.message).toBe('Booking successful!')
        expect(Booking.prototype.save).toHaveBeenCalledTimes(1)

        // ENHANCEMENT: Verify the constructor was called with the organizer enrolled in participantIDs
        const constructorArgs = Booking.mock.calls[0][0]
        expect(constructorArgs.participantIDs).toEqual(['fntstembe@gmail.com'])
        expect(constructorArgs.leftParticipantIDs).toEqual([])
      })
    })

    // GET /availability
    describe('GET /availability', () => {
      it('should ignore canceled bookings when checking availability', async () => {
      // Arrange
        Availability.findOne.mockResolvedValue({
          defaultDuration: 30,
          weeklySchedule: [{
            dayOfWeek: 2, // Tuesday
            slots: ['10:00', '10:30']
          }]
        })

        Booking.find.mockResolvedValue([
          { startTime: '10:00', status: 'upcoming' }
        ])

        // Act
        const response = await request(app)
          .get('/availability?lecturerId=test@lecturer.com&date=2026-05-05')

        // Assert
        expect(response.status).toBe(200)
        expect(response.body.bookedTimes).toContain('10:00')

        expect(Booking.find).toHaveBeenCalledWith({
          lecturerId: 'test@lecturer.com',
          date: '2026-05-05',
          status: { $ne: 'canceled' }
        })
      })
    })

    // GET / (Fetch Student Bookings)
    describe('GET /', () => {
      it('should fetch bookings and dynamically map status to canceled if student left', async () => {
      // Arrange: Mock chain .find().sort().lean()
        const fakeBookings = [
          {
            _id: '1',
            studentId: 'organizer@gmail.com',
            status: 'upcoming',
            participantIDs: ['organizer@gmail.com'],
            leftParticipantIDs: ['fntstembe@gmail.com'] 
          },
          {
            _id: '2',
            studentId: 'fntstembe@gmail.com',
            status: 'upcoming',
            participantIDs: ['fntstembe@gmail.com'],
            leftParticipantIDs: []
          }
        ]

        const mockLean = jest.fn().mockResolvedValue(fakeBookings)
        const mockSort = jest.fn().mockReturnValue({ lean: mockLean })
        Booking.find.mockReturnValue({ sort: mockSort })

        // Act
        const response = await request(app)
          .get('/?studentId=fntstembe@gmail.com')

        // Assert
        expect(response.status).toBe(200)
        expect(response.body).toHaveLength(2)

        // Verify the dynamic override worked for the session the user left
        expect(response.body[0].status).toBe('canceled')
        // Verify the active session remained untouched
        expect(response.body[1].status).toBe('upcoming')

        // Verify MongoDB was queried for both active AND left participation
        expect(Booking.find).toHaveBeenCalledWith({
          $or: [
            { participantIDs: 'fntstembe@gmail.com' },
            { leftParticipantIDs: 'fntstembe@gmail.com' }
          ]
        })
      })
    })

    // DELETE /:id (Organizer Cancel)
    describe('DELETE /:id', () => {
      it('should block unauthorized users and allow organizers to soft-cancel', async () => {
      // Arrange: Fake an existing booking owned by organizer@gmail.com
        const fakeBooking = {
          _id: 'booking_123',
          studentId: 'organizer@gmail.com',
          status: 'upcoming'
        }
        Booking.findById.mockResolvedValue(fakeBooking)
        Booking.findByIdAndUpdate.mockResolvedValue(true)

        // Act 1: Attempt to delete as a different user
        const failedRes = await request(app)
          .delete('/booking_123')
          .send({ studentEmail: 'wronguser@gmail.com' })

        // Assert 1
        expect(failedRes.status).toBe(403)
        expect(failedRes.body.message).toMatch(/Unauthorized: You can only cancel your own bookings/)
        expect(Booking.findByIdAndUpdate).not.toHaveBeenCalled()

        // Act 2: Attempt to delete as the correct organizer
        const successRes = await request(app)
          .delete('/booking_123')
          .send({ studentEmail: 'organizer@gmail.com' })

        // Assert 2
        expect(successRes.status).toBe(200)
        expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
          'booking_123',
          { status: 'canceled' }
        )
      })
    })

    // PUT /leave/:id (Joiner Leave)
    describe('PUT /leave/:id', () => {
      it('should safely shift a joiner from participantIDs to leftParticipantIDs', async () => {
      // Arrange
        Booking.findById.mockResolvedValue({ _id: 'booking_456' })
        Booking.findByIdAndUpdate.mockResolvedValue(true)

        // Act
        const response = await request(app)
          .put('/leave/booking_456')
          .send({ email: 'joiner@gmail.com' })

        // Assert
        expect(response.status).toBe(200)
        expect(response.body.message).toBe('Successfully left the session.')

        // Confirm the exact atomic database operations were requested
        expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
          'booking_456',
          {
            $pull: { participantIDs: 'joiner@gmail.com' },
            $addToSet: { leftParticipantIDs: 'joiner@gmail.com' }
          }
        )
      })
    })
  })
})
