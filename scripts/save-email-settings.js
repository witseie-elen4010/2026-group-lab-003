require('dotenv').config()

const mongoose = require('mongoose')
const EmailSettings = require('../src/models/emailSettings')

function getArg (name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? '' : process.argv[index + 1] || ''
}

function normalizeEmailPassword (pass) {
  return String(pass || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, '')
}

async function main () {
  const mongoUri = getArg('mongo') || process.env.MONGODB_URI
  const user = getArg('user')
  const pass = normalizeEmailPassword(getArg('pass'))
  const from = getArg('from') || user
  const service = getArg('service') || (user.includes('@gmail.com') ? 'gmail' : '')
  const host = getArg('host')
  const port = Number(getArg('port')) || 587
  const secure = getArg('secure') === 'true'

  if (!mongoUri) {
    throw new Error('Missing MongoDB URI. Pass --mongo "mongodb://..." or set MONGODB_URI.')
  }

  if (!user || !pass) {
    throw new Error('Usage: node scripts/save-email-settings.js --user sender@gmail.com --pass app_password')
  }

  await mongoose.connect(mongoUri)
  await EmailSettings.findOneAndUpdate(
    { name: 'default' },
    {
      $set: {
        enabled: true,
        service,
        host,
        port,
        secure,
        user,
        pass,
        from
      }
    },
    { upsert: true, new: true, runValidators: true }
  )

  await mongoose.disconnect()
  console.log(`Saved email sender settings for ${user}`)
}

main().catch(async error => {
  console.error(error.message)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
