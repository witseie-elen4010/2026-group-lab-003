const request = require('supertest')
const express = require('express')

// 1. MOCK FIRST! Tell Jest to intercept these before the router loads.
jest.mock('../src/models/Booking')
jest.mock('../src/models/Availability')

// 2. NOW import your router and models
const bookingsRouter = require('../src/routes/bookings')
const Booking = require('../src/models/Booking')
const Availability = require('../src/models/Availability')

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
        .post('/api/bookings')
        .send(newBookingData)

      // Assert
      expect(response.status).toBe(201)
      expect(response.body.message).toBe('Booking successful!')
      expect(Booking.prototype.save).toHaveBeenCalledTimes(1)
    })
  })

  describe('GET /api/availability', () => {
    it('should ignore canceled bookings when checking availability', async () => {
      // Arrange: Fake the responses for our database queries
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

      // Act: Request slots for a Tuesday
      const response = await request(app)
        .get('/api/availability?lecturerId=test@lecturer.com&date=2026-05-05')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.bookedTimes).toContain('10:00')

      // Prove that it specifically asked Mongoose to ignore 'canceled' bookings!
      expect(Booking.find).toHaveBeenCalledWith({
        lecturerId: 'test@lecturer.com',
        date: '2026-05-05',
        status: { $ne: 'canceled' }
      })
    })
  })
})
