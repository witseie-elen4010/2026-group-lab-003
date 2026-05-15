const mongoose = require('mongoose')

/**
 * Stores a short-lived, single-use token for password resets.
 * The token itself is stored as a SHA-256 hash so that a database
 * breach cannot be used to reset arbitrary accounts.
 */
const PasswordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Store only the hashed version of the token
  tokenHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  }
})

// Automatically remove expired documents (MongoDB TTL index)
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('PasswordResetToken', PasswordResetTokenSchema)