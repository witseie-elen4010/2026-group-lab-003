const request = require('supertest')
const bcrypt = require('bcrypt')

const app = require('../../src/server')
const User = require('../../src/models/user')
const PasswordResetToken = require('../../src/models/passwordResetToken')
const { sendPasswordResetEmail, sendNotification } = require('../../src/utils/emailService')

jest.mock('../../src/models/user')
jest.mock('../../src/models/passwordResetToken')
jest.mock('../../src/utils/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerificationOtp: jest.fn(),
  sendNotification: jest.fn()
}))

const validEmail = 'jane@student.wits.ac.za'
const userId = 'user123'
const makeUser = (overrides = {}) => ({
  _id: userId,
  name: 'Jane',
  email: validEmail,
  password: 'old-hash',
  save: jest.fn().mockResolvedValue(true),
  ...overrides
})

beforeEach(() => jest.clearAllMocks())

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
describe('POST /api/auth/forgot-password', () => {
  test('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({})
    expect(res.status).toBe(400)
    expect(User.findOne).not.toHaveBeenCalled()
  })

  test('creates hashed OTP and sends reset email', async () => {
    const user = makeUser()
    User.findOne.mockResolvedValue(user)
    PasswordResetToken.deleteMany.mockResolvedValue({})
    PasswordResetToken.create.mockResolvedValue({})

    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email })
    expect(res.status).toBe(200)
    expect(PasswordResetToken.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: user._id,
      tokenHash: expect.any(String),
      expiresAt: expect.any(Date)
    }))
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      user.email,
      expect.stringMatching(/^\d{6}$/),
      expect.stringContaining('/reset-password.html?email=')
    )
  })
})

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
describe('POST /api/auth/reset-password', () => {
  test('returns 400 for invalid or expired OTP', async () => {
    const user = makeUser()
    User.findOne.mockResolvedValue(user)
    PasswordResetToken.findOne.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: user.email, otp: '000000', newPassword: 'NewPassword1!' })

    expect(res.status).toBe(400)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  test('hashes password, consumes token, and notifies user', async () => {
    const otp = '123456'
    const user = makeUser()
    const record = { used: false, save: jest.fn().mockResolvedValue(true) }

    User.findOne.mockResolvedValue(user)
    PasswordResetToken.findOne.mockResolvedValue(record)

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: user.email, otp, newPassword: 'BrandNew123!' })

    expect(res.status).toBe(200)
    expect(record.used).toBe(true)
    const isPasswordUpdated = await bcrypt.compare('BrandNew123!', user.password)
    expect(isPasswordUpdated).toBe(true)
    expect(sendNotification).toHaveBeenCalledWith(user, expect.any(String), expect.any(String))
  })
})
