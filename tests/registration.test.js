const request = require('supertest')
const bcrypt = require('bcrypt')
const app = require('../src/server')
const User = require('../src/models/user')

// Mock the database so we don't save dummy data during tests
jest.mock('../src/models/user')

describe('POST /register - User Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // --- TEST 1: MISSING DATA VALIDATION ---
  test('should return 400 if required fields are missing', async () => {
    const incompleteData = { email: 'test@student.wits.ac.za' } // Missing password & name

    // Simulate an HTTP POST request
    const response = await request(app)
      .post('/api/register')
      .send(incompleteData)

    // We expect the server to reject it with a 400 status
    expect(response.status).toBe(400)
    // expect(response.body.message).toBe('All fields are required');

    // Verify the database was NEVER called
    expect(User.findOne).not.toHaveBeenCalled()
  })

  // --- TEST 2: DUPLICATE USER PREVENTION ---
  test('should return 400 if the email is already registered', async () => {
    const mockStudent = { name: 'John', surname: 'Smith', idNumber: '200000', email: 'john@student.wits.ac.za', role: 'student', password: 'Password123!' }
    // Simulate the database finding an existing user
    User.findOne.mockResolvedValue({ email: 'john@student.wits.ac.za' })

    const response = await request(app)
      .post('/api/register')
      .send(mockStudent)

    // Expect failure
    expect(response.status).toBe(400)

    // Verify we checked the DB, but didn't try to save
    expect(User.findOne).toHaveBeenCalledWith({ email: mockStudent.email })
    expect(User.prototype.save).not.toHaveBeenCalled()
  })

  // --- TEST 3: THE HAPPY PATH & PASSWORD VERIFICATION ---
  test('should return 201 and securely hash the password on success', async () => {
    const newStudent = {
      name: 'Jane',
      surname: 'Doe',
      idNumber: '200001',
      email: 'jane@student.wits.ac.za',
      role: 'student',
      password: 'SecurePassword123!'
    }

    // Simulate DB finding no existing user
    User.findOne.mockResolvedValue(null)

    // Simulate successful save
    User.prototype.save.mockResolvedValue({
      _id: '12345',
      name: newStudent.name,
      email: newStudent.email
    })

    const response = await request(app)
      .post('/api/register')
      .send(newStudent)

    // 1. Check HTTP response
    expect(response.status).toBe(201) // Or 200, depending on your route

    // 2. SECURE HASH CHECK
    // Grab the data that your route tried to save to MongoDB
    const userConstructorArgs = User.mock.calls[0][0]

    // The password passed to the DB should NOT be plain text
    expect(userConstructorArgs.password).not.toBe(newStudent.password)

    // The password MUST be a valid bcrypt hash
    const isHashValid = bcrypt.compareSync(newStudent.password, userConstructorArgs.password)
    expect(isHashValid).toBe(true)
  })
})
