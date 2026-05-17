require('dotenv').config()

const mongoose = require('mongoose')
const { sendNotification } = require('../src/utils/emailService')

async function main () {
  const to = process.argv[2] || process.env.TEST_EMAIL_TO || process.env.EMAIL_USER

  if (!to) {
    console.error('Usage: node scripts/test-email.js your-email@example.com')
    process.exit(1)
  }

  if (process.env.MONGODB_URI && mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI)
  }

  await sendNotification(
    { email: to, emailNotifications: true, name: 'Test User' },
    'Consultation Scheduler test email',
    [
      'This is a real email delivery test from Consultation Scheduler.',
      '',
      'If this reached your inbox, booking notifications can be delivered too.'
    ].join('\n')
  )

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
