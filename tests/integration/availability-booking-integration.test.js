const request = require('supertest')
const express = require('express')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server') // Optional but recommended for clean testing

// Import your router and models
const availabilityRouter = require('../src/routes/availability') // Adjust path to your route file
const User = require('../src/models/user')
const Availability = require('../src/models/Availability')

const app = express()
app.use(express.json())
app.use('/api/availability', availabilityRouter)

let mongoServer

// Setup an in-memory database before running tests so we don't mess up your real data
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  await mongoose.connect(uri)
})

// Clear data between tests and close connection at the end
afterEach(async () => {
  await User.deleteMany({})
  await Availability.deleteMany({})
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

describe('POST /api/availability/slot - Lecturer Name Resolution', () => {
  it('should successfully find the lecturer name from the User collection using idNumber', async () => {
    // 1. Seed a mock lecturer into our test database
    await User.create({
      idNumber: '2540701',
      name: 'Ofentse',
      surname: 'Tembe',
      email: 'ofenembe@gmail.com',
      role: 'lecturer'
    })

    // 2. Prepare mock slot data payload
    const newSlotData = {
      dayOfWeek: 1,
      start: '09:00',
      end: '10:00',
      duration: 60,
      course: 'INF300',
      venue: 'Lab 2',
      maxStudents: 5
    }

    // 3. Send the POST request passing the ID in the headers
    const response = await request(app)
      .post('/api/availability/slot')
      .set('x-lecturer-id', '2540701') // The header we debugged earlier
      .send(newSlotData)

    // 4. Assertions (The checks)
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)

    // Check that the returned response object contains the correct name
    expect(response.body.availability.lecturerName).toBe('Ofentse Tembe')

    // Check that it actually saved into the Availability database collection correctly
    const savedAvailability = await Availability.findOne({ lecturerEmail: '2540701' })
    expect(savedAvailability).toBeTruthy()
    expect(savedAvailability.lecturerName).toBe('Ofentse Tembe')
  })

  it('should fallback to "Unknown Lecturer" if the ID cannot be found in the database', async () => {
    const newSlotData = {
      dayOfWeek: 2,
      start: '11:00',
      end: '12:00',
      duration: 60,
      course: 'INF300',
      venue: 'Room 4',
      maxStudents: 10
    }

    // Send a request with an ID that doesn't exist in the database
    const response = await request(app)
      .post('/api/availability/slot')
      .set('x-lecturer-id', '9999999')
      .send(newSlotData)

    expect(response.status).toBe(200)
    expect(response.body.availability.lecturerName).toBe('Unknown Lecturer')
  })
})
