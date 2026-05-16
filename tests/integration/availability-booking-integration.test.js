const request = require('supertest')
const express = require('express')
const mongoose = require('mongoose')

const mockUsers = []
const mockAvailabilityStore = []

class MockAvailability {
  constructor (data = {}) {
    this.lecturerEmail = data.lecturerEmail
    this.lecturerName = data.lecturerName
    this.weeklySchedule = (data.weeklySchedule || []).map(day => ({
      dayOfWeek: day.dayOfWeek,
      slots: (day.slots || []).map(slot => ({
        _id: slot._id || new mongoose.Types.ObjectId(),
        start: slot.start,
        end: slot.end,
        duration: slot.duration,
        course: slot.course,
        venue: slot.venue,
        maxStudents: slot.maxStudents
      }))
    }))
    this.courses = [...(data.courses || [])]
    this.updatedAt = data.updatedAt
  }

  static async findOne (query) {
    return mockAvailabilityStore.find(item => item.lecturerEmail === query.lecturerEmail) || null
  }

  static async deleteMany () {
    mockAvailabilityStore.length = 0
  }

  async save () {
    const existingIndex = mockAvailabilityStore.findIndex(item => item.lecturerEmail === this.lecturerEmail)
    if (existingIndex === -1) {
      mockAvailabilityStore.push(this)
    } else {
      mockAvailabilityStore[existingIndex] = this
    }
    return this
  }

  markModified () {}
}

jest.mock('../../src/models/Availability', () => MockAvailability)
jest.mock('../../src/models/booking', () => ({
  find: jest.fn().mockResolvedValue([])
}))
jest.mock('../../src/models/activity', () => ({
  create: jest.fn().mockResolvedValue({})
}))
jest.mock('../../src/models/User', () => ({
  create: jest.fn(async user => {
    mockUsers.push(user)
    return user
  }),
  findOne: jest.fn(async query => {
    const conditions = query.$or || [query]
    return mockUsers.find(user => conditions.some(condition => {
      return Object.entries(condition).every(([key, value]) => user[key] === value)
    })) || null
  }),
  deleteMany: jest.fn(async () => {
    mockUsers.length = 0
  })
}))

const availabilityRouter = require('../../src/routes/availability')
const User = require('../../src/models/User')
const Availability = require('../../src/models/Availability')

const app = express()
app.use(express.json())
app.use('/api/availability', availabilityRouter)

afterEach(async () => {
  await User.deleteMany({})
  await Availability.deleteMany({})
  jest.clearAllMocks()
})

describe('POST /api/availability/slot - Lecturer Name Resolution', () => {
  it('should successfully find the lecturer name from the User collection using idNumber', async () => {
    await User.create({
      idNumber: '2540701',
      name: 'Ofentse',
      surname: 'Tembe',
      email: 'ofenembe@gmail.com',
      role: 'lecturer'
    })

    const response = await request(app)
      .post('/api/availability/slot')
      .set('x-lecturer-id', '2540701')
      .send({
        dayOfWeek: 1,
        start: '09:00',
        end: '10:00',
        duration: 60,
        course: 'INF300',
        venue: 'Lab 2',
        maxStudents: 5
      })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.availability.lecturerName).toBe('Ofentse Tembe')

    const savedAvailability = await Availability.findOne({ lecturerEmail: '2540701' })
    expect(savedAvailability).toBeTruthy()
    expect(savedAvailability.lecturerName).toBe('Ofentse Tembe')
  })

  it('should fallback to "Unknown Lecturer" if the ID cannot be found in the database', async () => {
    const response = await request(app)
      .post('/api/availability/slot')
      .set('x-lecturer-id', '9999999')
      .send({
        dayOfWeek: 2,
        start: '11:00',
        end: '12:00',
        duration: 60,
        course: 'INF300',
        venue: 'Room 4',
        maxStudents: 10
      })

    expect(response.status).toBe(200)
    expect(response.body.availability.lecturerName).toBe('Unknown Lecturer')
  })
})
