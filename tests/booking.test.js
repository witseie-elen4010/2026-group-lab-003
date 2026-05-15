// tests/booking.test.js
const request = require('supertest')
const express = require('express')

// 1. MOCK MODELS
jest.mock('../src/models/booking')
jest.mock('../src/models/Availability')

const Booking = require('../src/models/booking')
const Availability = require('../src/models/Availability')
const bookingsRouter = require('../src/routes/bookings')

// 2. SETUP APP
const app = express()
app.use(express.json())
app.use('/api/bookings', bookingsRouter) // Mount at the correct path

describe('Booking Validation Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Test 1: Missing Data
  it('should reject if required fields are missing', async () => {
    const response = await request(app)
      .post('/api/bookings') // CHANGED from /api/bookings/create
      .send({
        startTime: '10:00' // Missing date, lecturerId, etc.
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.message).toContain('Missing required fields')
  })

  // Test 2: Bad Format (e.g., someone typing "potato" instead of a time)
  it('should reject invalid time formats', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send({
        studentId: 'student@test.com',
        lecturerId: '123',
        date: '2026-05-11', // Added valid date to pass the missing fields check
        startTime: 'potato',
        endTime: '11:00',
        module: 'CS101'
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.message).toContain('Invalid time format')
  })

  // Test 3: Time Traveler (End time is before start time)
  it('should reject if end time is before start time', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send({
        studentId: 'student@test.com',
        lecturerId: '123',
        date: '2026-05-11',
        startTime: '14:00',
        endTime: '10:00', // End time is earlier!
        module: 'CS101'
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.message).toContain('end time must be after the start time')
  })

  // Test 4: Max Capacity Reached
  it('should reject if the consultation is at max capacity', async () => {
    const testDate = '2026-05-11'
    const dayOfWeek = new Date(testDate).getDay()

    // Mock Availability (Limit is 1 student)
    Availability.findOne.mockResolvedValue({
      lecturerEmail: '123',
      weeklySchedule: [{
        dayOfWeek,
        slots: [{
          start: '10:00',
          end: '11:00',
          course: 'CS101',
          maxStudents: 1
        }]
      }]
    })

    // Mock Bookings (1 student already booked)
    Booking.find.mockResolvedValue([
      { startTime: '10:00', studentId: 'someone_else@gmail.com' }
    ])

    const response = await request(app)
      .post('/api/bookings')
      .send({
        studentId: 'student@test.com',
        lecturerId: '123',
        date: testDate,
        startTime: '10:00',
        endTime: '11:00',
        module: 'CS101'
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.message).toContain('maximum capacity')
  })
})
