const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const nodemailer = require('nodemailer')
const EmailSettings = require('../models/emailSettings')

const LOG_PATH = path.resolve(__dirname, '../../email-log.txt')

function getEnvEmailConfig () {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS

  if (!user || !pass) return null

  return {
    service: process.env.EMAIL_SERVICE || (user.includes('@gmail.com') ? 'gmail' : ''),
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    user,
    pass,
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || user
  }
}

async function getDatabaseEmailConfig () {
  if (process.env.NODE_ENV === 'test' || mongoose.connection.readyState === 0) {
    return null
  }

  const settings = await EmailSettings.findOne({ name: 'default', enabled: true }).lean()
  if (!settings || !settings.user || !settings.pass) return null

  return {
    service: settings.service || (settings.user.includes('@gmail.com') ? 'gmail' : ''),
    host: settings.host || '',
    port: Number(settings.port) || 587,
    secure: Boolean(settings.secure),
    user: settings.user,
    pass: settings.pass,
    from: settings.from || settings.user
  }
}

async function getEmailConfig () {
  return getEnvEmailConfig() || await getDatabaseEmailConfig()
}

function createTransporter (config) {
  if (config.service && !config.host) {
    return nodemailer.createTransport({
      service: config.service,
      auth: {
        user: config.user,
        pass: config.pass
      }
    })
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  })
}

function writeLog (entry, label = 'SIMULATED EMAIL') {
  const line = `[${new Date().toISOString()}] TO: ${entry.to} | SUBJECT: ${entry.subject}\n${entry.body}\n${'-'.repeat(72)}\n`
  fs.appendFileSync(LOG_PATH, line, 'utf8')
  console.log(`\n${label}\n${line}`)
}

async function sendEmail (entry) {
  const config = await getEmailConfig()

  if (!config || process.env.NODE_ENV === 'test') {
    if (process.env.NODE_ENV !== 'test' && !config) {
      console.warn('Real email not configured. Add sender settings to the database or set EMAIL_USER and EMAIL_PASS.')
    }
    writeLog(entry)
    return
  }

  try {
    const transporter = createTransporter(config)
    await transporter.sendMail({
      from: config.from,
      to: entry.to,
      subject: entry.subject,
      text: entry.body
    })
    writeLog(entry, 'EMAIL SENT')
  } catch (error) {
    writeLog(entry, 'EMAIL FAILED - LOGGED LOCALLY')
    console.error('Failed to send email:', error.message)
  }
}

function sendPasswordResetEmail (toEmail, resetLink) {
  return sendEmail({
    to: toEmail,
    subject: 'Consultation Scheduler - Password Reset',
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
  })
}

function sendNotification (user, subject, body) {
  if (!user.emailNotifications) {
    console.log(`Notification suppressed for ${user.email} (notifications OFF)`)
    return
  }

  return sendEmail({ to: user.email, subject, body })
}

module.exports = { sendPasswordResetEmail, sendNotification }
