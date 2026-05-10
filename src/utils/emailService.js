/**
 * Simulated email service. Drop-in replacement with Nodemailer (or any in production; for now every "sent" email is printed
 * to the console and written to ./email-log.txt so the acceptance criteria of "simulated email log" is satisfied without an external SMTP server.
 */

const fs = require('fs')
const path = require('path')

const LOG_PATH = path.resolve(__dirname, '../../email-log.txt')

/**
 * Append a record to the flat-file email log.
 */
function _writeLog(entry) {
  const line = `[${new Date().toISOString()}] TO: ${entry.to} | SUBJECT: ${entry.subject}\n${entry.body}\n${'─'.repeat(72)}\n`
  fs.appendFileSync(LOG_PATH, line, 'utf8')
  console.log('\n📧 SIMULATED EMAIL\n' + line)
}

/**
 * Send a password-reset email.
 * @param {string} toEmail Recipient email address
 * @param {string} resetLink Full URL the user should visit (with token)
 */
function sendPasswordResetEmail(toEmail, resetLink) {
  const entry = {
    to: toEmail,
    subject: 'Consultation Scheduler – Password Reset',
    body: [
      'You (or someone else) requested a password reset for your account.',
      '',
      'Click the link below to set a new password. The link expires in 1 hour.',
      '',
      ` ${resetLink}`,
      '',
      'If you did not request this, you can safely ignore this email.',
      'Your password will NOT change until you click the link above.'
    ].join('\n')
  }
  _writeLog(entry)
}

/**
 * Send a generic notification email (respects the user's emailNotifications flag).
 * @param {object} user Mongoose user document 
 * @param {string} subject
 * @param {string} body
 */
function sendNotification(user, subject, body) {
  if (!user.emailNotifications) {
    console.log(`📭 Notification suppressed for ${user.email} (notifications OFF)`)
    return
  }
  _writeLog({ to: user.email, subject, body })
}

module.exports = { sendPasswordResetEmail, sendNotification }
