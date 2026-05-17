const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const nodemailer = require('nodemailer')
const EmailSettings = require('../models/emailSettings')

const LOG_PATH = path.resolve(__dirname, '../../email-log.txt')
const DEFAULT_EMAIL_TIMEOUT_MS = 30000

function getEmailTimeoutMs () {
  const value = Number(process.env.EMAIL_TIMEOUT_MS || process.env.SMTP_TIMEOUT_MS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_EMAIL_TIMEOUT_MS
}

function normalizeEmailPassword (pass) {
  return String(pass || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, '')
}

function normalizeEnvString (value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '')
}

function parseEmailAddress (value) {
  const text = normalizeEnvString(value)
  const match = text.match(/^(.*?)\s*<([^>]+)>$/)

  if (!match) return { email: text }

  const name = match[1].trim().replace(/^['"]|['"]$/g, '')
  return {
    email: match[2].trim(),
    ...(name ? { name } : {})
  }
}

function getEnvEmailConfig () {
  const brevoApiKey = normalizeEnvString(process.env.BREVO_API_KEY)
  const brevoFrom = normalizeEnvString(process.env.BREVO_FROM || process.env.EMAIL_FROM || process.env.SMTP_FROM)

  if (brevoApiKey && brevoFrom) {
    return {
      provider: 'brevo',
      apiKey: brevoApiKey,
      from: brevoFrom,
      timeoutMs: getEmailTimeoutMs()
    }
  }

  const user = normalizeEnvString(process.env.SMTP_USER || process.env.EMAIL_USER)
  const pass = normalizeEmailPassword(process.env.SMTP_PASS || process.env.EMAIL_PASS)

  if (!user || !pass) return null

  return {
    service: normalizeEnvString(process.env.EMAIL_SERVICE) || (user.includes('@gmail.com') ? 'gmail' : ''),
    host: normalizeEnvString(process.env.SMTP_HOST),
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    user,
    pass,
    from: normalizeEnvString(process.env.SMTP_FROM || process.env.EMAIL_FROM || user),
    timeoutMs: getEmailTimeoutMs()
  }
}

async function getDatabaseEmailConfig () {
  if (process.env.NODE_ENV === 'test' || mongoose.connection.readyState === 0) {
    return null
  }

  const settings = await EmailSettings.findOne({ name: 'default', enabled: true }).lean()
  if (!settings || !settings.user || !settings.pass) return null
  const pass = normalizeEmailPassword(settings.pass)

  return {
    service: settings.service || (settings.user.includes('@gmail.com') ? 'gmail' : ''),
    host: settings.host || '',
    port: Number(settings.port) || 587,
    secure: Boolean(settings.secure),
    user: settings.user,
    pass,
    from: settings.from || settings.user,
    timeoutMs: getEmailTimeoutMs()
  }
}

async function getEmailConfig () {
  return getEnvEmailConfig() || await getDatabaseEmailConfig()
}

function createTransporter (config) {
  const timeoutOptions = {
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs
  }

  if (config.service && !config.host) {
    return nodemailer.createTransport({
      service: config.service,
      auth: {
        user: config.user,
        pass: config.pass
      },
      ...timeoutOptions
    })
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    },
    ...timeoutOptions
  })
}

async function sendWithBrevo (config, entry) {
  if (typeof fetch !== 'function') {
    throw new Error('Brevo email requires a Node.js runtime with fetch support.')
  }

  const response = await withTimeout(
    fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: parseEmailAddress(config.from),
        to: [{ email: entry.to }],
        subject: entry.subject,
        textContent: entry.body
      })
    }),
    config.timeoutMs,
    `Email send timed out after ${config.timeoutMs}ms`
  )

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch (_) {}
    throw new Error(`Brevo API returned ${response.status}${detail ? `: ${detail}` : ''}`)
  }
}

function withTimeout (promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs)
    })
  ])
}

function writeLog (entry, label = 'SIMULATED EMAIL') {
  const line = `[${new Date().toISOString()}] TO: ${entry.to} | SUBJECT: ${entry.subject}\n${entry.body}\n${'-'.repeat(72)}\n`
  fs.appendFileSync(LOG_PATH, line, 'utf8')
  console.log(`\n${label}\n${line}`)
  return LOG_PATH
}

async function sendEmail (entry) {
  const config = await getEmailConfig()

  if (!config || process.env.NODE_ENV === 'test') {
    if (process.env.NODE_ENV !== 'test' && !config) {
      console.warn('Real email not configured. Add sender settings to the database or set EMAIL_USER and EMAIL_PASS.')
    }
    const logPath = writeLog(entry)
    return { sent: false, simulated: true, logPath }
  }

  try {
    if (config.provider === 'brevo') {
      await sendWithBrevo(config, entry)
    } else {
      const transporter = createTransporter(config)
      await withTimeout(
        transporter.sendMail({
          from: config.from,
          to: entry.to,
          subject: entry.subject,
          text: entry.body
        }),
        config.timeoutMs,
        `Email send timed out after ${config.timeoutMs}ms`
      )
    }
    const logPath = writeLog(entry, 'EMAIL SENT')
    return { sent: true, simulated: false, logPath }
  } catch (error) {
    const logPath = writeLog(entry, 'EMAIL FAILED - LOGGED LOCALLY')
    console.error('Failed to send email:', error.message)
    return { sent: false, simulated: false, logPath, error: error.message }
  }
}

function sendPasswordResetEmail (toEmail, otp, resetLink = '') {
  return sendEmail({
    to: toEmail,
    subject: 'Consultation Scheduler - Password Reset',
    body: [
      'You (or someone else) requested a password reset for your account.',
      '',
      `Your password reset OTP is: ${otp}`,
      '',
      'This OTP expires in 1 hour.',
      resetLink ? `Reset your password here: ${resetLink}` : '',
      '',
      'If you did not request this, you can safely ignore this email.',
      'Your password will NOT change until this OTP is entered.'
    ].filter(Boolean).join('\n')
  })
}

function sendEmailVerificationOtp (toEmail, otp) {
  return sendEmail({
    to: toEmail,
    subject: 'Consultation Scheduler - Verify your email',
    body: [
      'Welcome to Consultation Scheduler.',
      '',
      `Your email verification code is: ${otp}`,
      '',
      'This code expires in 10 minutes.',
      'If you did not create an account, you can safely ignore this email.'
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

module.exports = { sendPasswordResetEmail, sendEmailVerificationOtp, sendNotification }
