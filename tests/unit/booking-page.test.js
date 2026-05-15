const request = require('supertest')
const express = require('express')

// 1. MOCK MODELS
jest.mock('../../src/models/booking')
jest.mock('../../src/models/Availability')

// 2. IMPORT MODELS AND ROUTER
const Booking = require('../../src/models/booking')
const Availability = require('../../src/models/Availability')
const bookingsRouter = require('../../src/routes/bookings')

// 3. SETUP APP
const app = express()
app.use(express.json())
app.use('/api/bookings', bookingsRouter)

describe('Booking API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/bookings', () => {
    it('should successfully create a new booking with a studentId', async () => {
      // 1. Arrange
      Booking.prototype.save = jest.fn().mockResolvedValue({ _id: 'mockId' })

      const testDate = '2026-05-11' // A Monday
      const dayOfWeek = new Date(testDate).getDay()

      // Mock Availability so the middleware allows it through
      Availability.findOne.mockResolvedValue({
        lecturerEmail: 'lecturer_1',
        weeklySchedule: [{
          dayOfWeek,
          slots: [{
            start: '10:00',
            end: '10:30',
            course: 'CS101',
            maxStudents: 5
          }]
        }]
      })

      // Mock existing bookings (0 current bookings)
      Booking.countDocuments = jest.fn().mockResolvedValue(0)
      Booking.find.mockResolvedValue([])

      const newBookingData = {
        studentId: 'fntstembe@gmail.com',
        lecturerId: 'lecturer_1',
        date: testDate,
        startTime: '10:00',
        endTime: '10:30',
        module: 'CS101',
        topic: 'Test Consultation'
      }

      // 2. Act
      const response = await request(app)
        .post('/api/bookings')
        .send(newBookingData)

      // 3. Assert
      expect(response.status).toBe(201)
      expect(response.body.message).toBe('Booking successful!')
      expect(Booking.prototype.save).toHaveBeenCalledTimes(1)
    })
  })

  describe('GET /api/bookings/availability', () => {
    it('should ignore canceled bookings when checking availability', async () => {
      // Arrange
      const testDate = '2026-05-05' // A Tuesday (Day 2)

      Availability.findOne.mockResolvedValue({
        lecturerEmail: 'test@lecturer.com',
        weeklySchedule: [{
          dayOfWeek: 2,
          slots: [{
            start: '10:00',
            end: '10:30',
            course: 'CS101',
            maxStudents: 5
          }]
        }]
      })

      // Mock an existing canceled booking and an upcoming one
      Booking.find.mockResolvedValue([
        { startTime: '10:00', status: 'upcoming' }
      ])

      // Act
      const response = await request(app)
        .get(`/api/bookings/availability?lecturerId=test@lecturer.com&date=${testDate}`)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.bookedTimes).toContain('10:00')

      // Ensure the query correctly filters out canceled bookings!
      expect(Booking.find).toHaveBeenCalledWith({
        lecturerId: 'test@lecturer.com',
        date: testDate,
        status: { $ne: 'canceled' }
      })
    })
  })
})
