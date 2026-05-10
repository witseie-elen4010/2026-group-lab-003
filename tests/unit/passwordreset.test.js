const request = require('supertest')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const app = require('../../src/server')
const User = require('../../src/models/user')
const PasswordResetToken = require('../../src/models/passwordResetToken')
const {
  sendPasswordResetEmail,
  sendNotification
} = require('../../src/utils/emailService')

jest.mock('../../src/models/user')
jest.mock('../../src/models/passwordResetToken')
jest.mock('../../src/utils/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendNotification: jest.fn()
}))

const hashToken = token =>
  crypto.createHash('sha256').update(token).digest('hex')

beforeEach(() => jest.clearAllMocks())

// ─── Fixtures ────────────────────────────────────────────────────────────────
const validEmail = 'jane@student.wits.ac.za'
const userId = 'user123'

const makeUser = (overrides = {}) => ({
  _id: userId,
  name: 'Jane',
  email: validEmail,
  password: 'old-hash',
  emailNotifications: true,
  save: jest.fn().mockResolvedValue(true),
  ...overrides
})

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
describe('POST /api/auth/forgot-password', () => {
  test('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({})

    expect(res.status).toBe(400)
    expect(User.findOne).not.toHaveBeenCalled()
  })

  test('returns 200 for unregistered email (prevents enumeration)', async () => {
    User.findOne.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@student.wits.ac.za' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  test('creates hashed token and sends reset email', async () => {
    const user = makeUser()
    User.findOne.mockResolvedValue(user)
    PasswordResetToken.deleteMany.mockResolvedValue({})
    PasswordResetToken.create.mockResolvedValue({})

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: user.email })

    expect(res.status).toBe(200)
    expect(PasswordResetToken.deleteMany).toHaveBeenCalledWith({
      userId: user._id,
      used: false
    })
    expect(PasswordResetToken.create).toHaveBeenCalledTimes(1)

    const saved = PasswordResetToken.create.mock.calls[0][0]
    expect(saved.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(saved.expiresAt).toBeInstanceOf(Date)

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      user.email,
      expect.any(String)
    )

    const link = sendPasswordResetEmail.mock.calls[0][1]
    const rawToken = new URL(link).searchParams.get('token')
    expect(hashToken(rawToken)).toBe(saved.tokenHash)
  })
})

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
describe('POST /api/auth/reset-password', () => {
  test('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: validEmail, token: 'token' })

    expect(res.status).toBe(400)
    expect(User.findOne).not.toHaveBeenCalled()
    expect(PasswordResetToken.findOne).not.toHaveBeenCalled()
  })

  test('returns 400 for short passwords', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: validEmail, token: 'abc', newPassword: 'short' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/8 characters/i)
  })

  test('returns 400 for invalid or expired token', async () => {
    const user = makeUser()
    User.findOne.mockResolvedValue(user)
    PasswordResetToken.findOne.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: user.email, token: 'expiredtoken', newPassword: 'NewPassword1!' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid or expired/i)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  test('hashes password, consumes token, and notifies user', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex')
    const user = makeUser({ password: 'old-hash' })
    const record = {
      used: false,
      save: jest.fn().mockResolvedValue(true)
    }

    User.findOne.mockResolvedValue(user)
    PasswordResetToken.findOne.mockResolvedValue(record)

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: user.email, token: rawToken, newPassword: 'BrandNew123!' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(record.used).toBe(true)
    expect(record.save.mock.invocationCallOrder[0])
      .toBeLessThan(user.save.mock.invocationCallOrder[0])

    const isPasswordUpdated = await bcrypt.compare('BrandNew123!', user.password)
    expect(user.password).not.toBe('BrandNew123!')
    expect(isPasswordUpdated).toBe(true)

    expect(sendNotification).toHaveBeenCalledTimes(1)
    expect(sendNotification.mock.calls[0][0]).toBe(user)
  })

  test('still calls notification service when user opted out', async () => {
    const user = makeUser({ emailNotifications: false })
    User.findOne.mockResolvedValue(user)
    PasswordResetToken.findOne.mockResolvedValue({
      used: false,
      save: jest.fn().mockResolvedValue(true)
    })

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: user.email,
        token: crypto.randomBytes(32).toString('hex'),
        newPassword: 'AnotherPass1!'
      })

    expect(res.status).toBe(200)
    expect(sendNotification).toHaveBeenCalledWith(
      user,
      expect.any(String),
      expect.any(String)
    )
  })
})