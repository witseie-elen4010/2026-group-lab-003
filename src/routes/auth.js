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
const { sendPasswordResetEmail, sendNotification } = require('../utils/emailService')

const SALT_ROUNDS = 10, TOKEN_EXPIRY_MS = 60 * 60 * 1000

// Helpers
const hashToken = raw => crypto.createHash('sha256').update(raw).digest('hex')

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
    const { email } = req.body
    if (!email) return res.status(400).json({ success: false, error: 'Email required' })
    const user = await User.findOne({ email })
    if (user) {
      await PasswordResetToken.deleteMany({ userId: user._id, used: false })
      const rawToken = crypto.randomBytes(32).toString('hex')
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS)
      })
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      sendPasswordResetEmail(email, `${baseUrl}/reset-password.html?token=${rawToken}&email=${encodeURIComponent(email)}`)
    }
    res.json({ success: true, message: 'If registered, you will receive a reset link.' })
  } catch (err) {
    console.error('forgot-password error:', err)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body
    if (!email || !token || !newPassword) return res.status(400).json({ success: false, error: 'Missing fields' })
    if (newPassword.length < 8) return res.status(400).json({ success: false, error: 'Password too short' })

    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ success: false, error: 'Invalid/expired link' })

    const record = await PasswordResetToken.findOne({
      userId: user._id, tokenHash: hashToken(token), used: false, expiresAt: { $gt: new Date() }
    })
    if (!record) return res.status(400).json({ success: false, error: 'Invalid/expired link' })

    record.used = true; await record.save()
    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS); await user.save()

    sendNotification(user, 'Your password was changed', `Hi ${user.name},\n\nYour password was just changed.\nIf this wasn’t you, contact support.`)
    res.json({ success: true, message: 'Password updated.' })
  } catch (err) {
    console.error('reset-password error:', err)
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
