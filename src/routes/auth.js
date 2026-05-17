/**
 * routes/auth.js
 * Auth routes: forgot/reset password & profile
 */

const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const bcrypt = require('bcrypt')

const User = require('../models/user')
const PasswordResetToken = require('../models/passwordResetToken')
const EmailVerificationToken = require('../models/emailVerificationToken')
const { sendPasswordResetEmail, sendEmailVerificationOtp, sendNotification } = require('../utils/emailService')

const SALT_ROUNDS = 10, TOKEN_EXPIRY_MS = 60 * 60 * 1000
const EMAIL_OTP_EXPIRY_MS = 10 * 60 * 1000

// Helpers
const hashToken = raw => crypto.createHash('sha256').update(raw).digest('hex')
const generateOtp = () => String(crypto.randomInt(100000, 1000000))
const normalizeEmail = email => String(email || '').trim().toLowerCase()

function shouldBlockOtpWhenEmailFails (delivery) {
  return process.env.NODE_ENV === 'production' && delivery && !delivery.sent
}

async function sendVerificationOtp (user) {
  const otp = generateOtp()
  await EmailVerificationToken.deleteMany({ userId: user._id, used: false })
  await EmailVerificationToken.create({
    userId: user._id,
    otpHash: hashToken(otp),
    expiresAt: new Date(Date.now() + EMAIL_OTP_EXPIRY_MS)
  })
  const delivery = await sendEmailVerificationOtp(user.email, otp)
  return { otp, delivery }
}

async function requireAuth(req, res, next) {
  const email = req.session?.userEmail || req.headers['x-user-email']
  if (!email) return res.status(401).json({ success: false, error: 'Unauthorised' })
  const user = await User.findOne({ email })
  if (!user) return res.status(401).json({ success: false, error: 'Unauthorised' })
  req.user = user; next()
}

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email)
    if (!email) return res.status(400).json({ success: false, error: 'Email required' })
    const user = await User.findOne({ email })
    let delivery = null
    let resetOtp = null
    if (user) {
      await PasswordResetToken.deleteMany({ userId: user._id, used: false })
      resetOtp = generateOtp()
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash: hashToken(resetOtp),
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS)
      })
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      delivery = await sendPasswordResetEmail(email, resetOtp, `${baseUrl}/reset-password.html?email=${encodeURIComponent(email)}`)
    }
    if (shouldBlockOtpWhenEmailFails(delivery)) {
      return res.status(502).json({
        success: false,
        error: 'Password reset email could not be sent. Please try again shortly.'
      })
    }
    const localOtpVisible = process.env.NODE_ENV !== 'production' && delivery?.simulated
    res.json({
      success: true,
      message: localOtpVisible
        ? `If registered, a reset OTP was written to ${delivery.logPath}.`
        : 'If registered, you will receive a password reset OTP.',
      devOtp: localOtpVisible ? resetOtp : undefined
    })
  } catch (err) {
    console.error('forgot-password error:', err)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { otp, newPassword } = req.body
    const email = normalizeEmail(req.body.email)
    if (!email || !otp || !newPassword) return res.status(400).json({ success: false, error: 'Email, OTP, and new password are required' })
    if (newPassword.length < 8) return res.status(400).json({ success: false, error: 'Password too short' })

    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ success: false, error: 'Invalid or expired OTP' })

    const record = await PasswordResetToken.findOne({
      userId: user._id, tokenHash: hashToken(otp), used: false, expiresAt: { $gt: new Date() }
    })
    if (!record) return res.status(400).json({ success: false, error: 'Invalid or expired OTP' })

    record.used = true; await record.save()
    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS); await user.save()

    sendNotification(user, 'Your password was changed', `Hi ${user.name},\n\nYour password was just changed.\nIf this wasn’t you, contact support.`)
    res.json({ success: true, message: 'Password updated.' })
  } catch (err) {
    console.error('reset-password error:', err)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

router.post('/verify-email', async (req, res) => {
  try {
    const { otp } = req.body
    const email = normalizeEmail(req.body.email)
    if (!email || !otp) return res.status(400).json({ success: false, error: 'Email and OTP required' })

    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ success: false, error: 'Invalid or expired OTP' })
    if (user.emailVerified) return res.json({ success: true, message: 'Email already verified.' })

    const record = await EmailVerificationToken.findOne({
      userId: user._id,
      otpHash: hashToken(otp),
      used: false,
      expiresAt: { $gt: new Date() }
    })
    if (!record) return res.status(400).json({ success: false, error: 'Invalid or expired OTP' })

    record.used = true
    await record.save()
    user.emailVerified = true
    await user.save()

    res.json({ success: true, message: 'Email verified. You can now log in.' })
  } catch (err) {
    console.error('verify-email error:', err)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

router.post('/resend-verification', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email)
    if (!email) return res.status(400).json({ success: false, error: 'Email required' })

    const user = await User.findOne({ email })
    let otpResult = null
    if (user && !user.emailVerified) {
      otpResult = await sendVerificationOtp(user)
    }
    if (shouldBlockOtpWhenEmailFails(otpResult?.delivery)) {
      return res.status(502).json({
        success: false,
        error: 'Verification email could not be sent. Please try again shortly.'
      })
    }

    const localOtpVisible = process.env.NODE_ENV !== 'production' && otpResult?.delivery?.simulated
    res.json({
      success: true,
      message: localOtpVisible
        ? `Email sending is not configured, so the OTP was written to ${otpResult.delivery.logPath}.`
        : 'If verification is needed, a new OTP has been sent.',
      devOtp: localOtpVisible ? otpResult.otp : undefined
    })
  } catch (err) {
    console.error('resend-verification error:', err)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

// Profile
router.get('/profile', requireAuth, (req, res) => {
  const { name, surname, email, role, idNumber, displayName, emailNotifications } = req.user
  res.json({ success: true, user: { name, surname, email, role, idNumber, displayName, emailNotifications } })
})

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { displayName, emailNotifications } = req.body
    const updates = {}
    if (displayName !== undefined) updates.displayName = String(displayName).trim().slice(0, 60)
    if (emailNotifications !== undefined) updates.emailNotifications = !!emailNotifications
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, error: 'No valid fields' })

    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
    res.json({ success: true, message: 'Profile updated.', user: {
      name: updated.name, surname: updated.surname, email: updated.email,
      role: updated.role, displayName: updated.displayName, emailNotifications: updated.emailNotifications
    }})
  } catch (err) {
    console.error('profile update error:', err)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

module.exports = router
