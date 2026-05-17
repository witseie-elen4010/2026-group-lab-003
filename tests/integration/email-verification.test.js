const request = require('supertest')
const crypto = require('crypto')
const bcrypt = require('bcrypt')

jest.mock('../../src/models/user', () => ({
  findOne: jest.fn()
}))

jest.mock('../../src/models/emailVerificationToken', () => ({
  findOne: jest.fn(),
  deleteMany: jest.fn(),
  create: jest.fn()
}))

jest.mock('../../src/utils/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerificationOtp: jest.fn(),
  sendNotification: jest.fn()
}))

const app = require('../../src/app')
const User = require('../../src/models/user')
const EmailVerificationToken = require('../../src/models/emailVerificationToken')
const { sendEmailVerificationOtp } = require('../../src/utils/emailService')

const hashOtp = otp => crypto.createHash('sha256').update(String(otp)).digest('hex')

describe('Email verification OTP flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('verifies a valid OTP and marks the token as used', async () => {
    const user = {
      _id: 'user-1',
      email: 'student@wits.ac.za',
      emailVerified: false,
      save: jest.fn().mockResolvedValue(true)
    }
    const record = {
      used: false,
      save: jest.fn().mockResolvedValue(true)
    }
    User.findOne.mockResolvedValue(user)
    EmailVerificationToken.findOne.mockResolvedValue(record)

    const response = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: user.email, otp: '123456' })

    expect(response.status).toBe(200)
    expect(response.body.message).toContain('Email verified')
    expect(EmailVerificationToken.findOne).toHaveBeenCalledWith({
      userId: user._id,
      otpHash: hashOtp('123456'),
      used: false,
      expiresAt: { $gt: expect.any(Date) }
    })
    expect(record.used).toBe(true)
    expect(record.save).toHaveBeenCalled()
    expect(user.emailVerified).toBe(true)
    expect(user.save).toHaveBeenCalled()
  })

  it('rejects invalid or expired OTPs', async () => {
    User.findOne.mockResolvedValue({
      _id: 'user-1',
      email: 'student@wits.ac.za',
      emailVerified: false
    })
    EmailVerificationToken.findOne.mockResolvedValue(null)

    const response = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'student@wits.ac.za', otp: '000000' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Invalid or expired OTP')
  })

  it('resends verification OTP for unverified users', async () => {
    const user = {
      _id: 'user-1',
      email: 'student@wits.ac.za',
      emailVerified: false
    }
    User.findOne.mockResolvedValue(user)

    const response = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: user.email })

    expect(response.status).toBe(200)
    expect(EmailVerificationToken.deleteMany).toHaveBeenCalledWith({ userId: user._id, used: false })
    expect(EmailVerificationToken.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: user._id,
      otpHash: expect.any(String),
      expiresAt: expect.any(Date)
    }))
    expect(sendEmailVerificationOtp).toHaveBeenCalledWith(user.email, expect.stringMatching(/^\d{6}$/))
  })

  it('does not resend OTP for already verified users', async () => {
    User.findOne.mockResolvedValue({
      _id: 'user-1',
      email: 'student@wits.ac.za',
      emailVerified: true
    })

    const response = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'student@wits.ac.za' })

    expect(response.status).toBe(200)
    expect(EmailVerificationToken.create).not.toHaveBeenCalled()
    expect(sendEmailVerificationOtp).not.toHaveBeenCalled()
  })

  it('blocks login until the user verifies their email', async () => {
    const password = 'SecurePassword123!'
    const hashedPassword = await bcrypt.hash(password, 10)
    User.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          email: 'student@wits.ac.za',
          password: hashedPassword,
          emailVerified: false
        })
      })
    })

    const response = await request(app)
      .post('/api/login')
      .send({ email: 'student@wits.ac.za', password })

    expect(response.status).toBe(403)
    expect(response.body.message).toBe('Please verify your email before logging in.')
  })
})
