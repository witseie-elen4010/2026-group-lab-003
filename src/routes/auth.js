/**
 * routes/auth.js
 *
 * Handles:
 * POST /api/auth/forgot-password – request a reset link
 * POST /api/auth/reset-password – consume token & set new password
 * GET /api/auth/profile – get current user profile
 * PUT /api/auth/profile – update displayName / emailNotifications
 *
 * Authentication is kept intentionally simple (email passed in body /
 * header) so it slots into the existing session-less architecture.
 * Swap the `requireAuth` middleware for a real JWT/session guard when ready.
 */

const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const bcrypt = require('bcrypt')

const User = require('../models/user')
const PasswordResetToken = require('../models/passwordResetToken')
const { sendPasswordResetEmail, sendNotification } = require('../utils/emailService')

const SALT_ROUNDS = 10
const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

// ─── helpers ──────────────────────────────────────────────────────────────────

/** SHA-256 hash of a raw token string */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/**
 * Minimal auth guard: expects the caller to send
 * X-User-Email: user@example.com
 * in the request header. Replace with JWT verification in production.
 */
async function requireAuth(req, res, next) {
  const email = req.headers['x-user-email']
  if (!email) return res.status(401).json({ success: false, error: 'Unauthorised' })
  const user = await User.findOne({ email })
  if (!user) return res.status(401).json({ success: false, error: 'Unauthorised' })
  req.user = user
  next()
}

// ─── Password Reset ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Always returns 200 so that an attacker cannot enumerate registered emails.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' })

    const user = await User.findOne({ email })

    if (user) {
      // Invalidate any existing unused token for this user
      await PasswordResetToken.deleteMany({ userId: user._id, used: false })

      // Generate a cryptographically secure random token
      const rawToken = crypto.randomBytes(32).toString('hex') // 256-bit

      await PasswordResetToken.create({
        userId: user._id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS)
      })

      // Build the reset URL (FRONTEND_URL env var should be set in production)
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      const resetLink = `${baseUrl}/reset-password.html?token=${rawToken}&email=${encodeURIComponent(email)}`

      sendPasswordResetEmail(email, resetLink)
    }

    // Identical response whether or not the email was found
    res.status(200).json({
      success: true,
      message: 'If that email is registered you will receive a reset link shortly.'
    })
  } catch (err) {
    console.error('forgot-password error:', err)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

/**
 * POST /api/auth/reset-password
 * Body: { email, token, newPassword }
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body

    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' })
    }

    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ success: false, error: 'Invalid or expired reset link' })

    const record = await PasswordResetToken.findOne({
      userId: user._id,
      tokenHash: hashToken(token),
      used: false,
      expiresAt: { $gt: new Date() }
    })

    if (!record) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset link' })
    }

    // Mark token as used BEFORE updating the password (prevents replay on error)
    record.used = true
    await record.save()

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS)
    await user.save()

    // Notify the user that their password changed
    sendNotification(user, 'Your password was changed', [
      `Hi ${user.name},`,
      '',
      'Your Consultation Scheduler password was just changed.',
      'If this was not you, please contact support immediately.'
    ].join('\n'))

    res.status(200).json({ success: true, message: 'Password updated successfully.' })
  } catch (err) {
    console.error('reset-password error:', err)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

// ─── Profile Management ────────────────────────────────────────────────────────

/**
 * GET /api/auth/profile
 * Header: X-User-Email
 */
router.get('/profile', requireAuth, (req, res) => {
  const { name, surname, email, role, idNumber, displayName, emailNotifications } = req.user
  res.status(200).json({
    success: true,
    user: { name, surname, email, role, idNumber, displayName, emailNotifications }
  })
})

/**
 * PUT /api/auth/profile
 * Header: X-User-Email
 * Body: { displayName?, emailNotifications? }
 *
 * Only the two mutable profile fields are accepted; email/role/idNumber
 * changes are out of scope and rejected silently.
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { displayName, emailNotifications } = req.body

    const updates = {}
    if (displayName !== undefined) updates.displayName = String(displayName).trim().slice(0, 60)
    if (emailNotifications !== undefined) updates.emailNotifications = Boolean(emailNotifications)

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' })
    }

    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true })

    res.status(200).json({
      success: true,
      message: 'Profile updated.',
      user: {
        name: updated.name,
        surname: updated.surname,
        email: updated.email,
        role: updated.role,
        displayName: updated.displayName,
        emailNotifications: updated.emailNotifications
      }
    })
  } catch (err) {
    console.error('profile update error:', err)
    res.status(500).json({ success: false, error: 'Server error' })
  }
})

module.exports = router
