const mongoose = require('mongoose')

const emailSettingsSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'default',
    unique: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  service: {
    type: String,
    default: 'gmail',
    trim: true
  },
  host: {
    type: String,
    default: '',
    trim: true
  },
  port: {
    type: Number,
    default: 587
  },
  secure: {
    type: Boolean,
    default: false
  },
  user: {
    type: String,
    required: true,
    trim: true
  },
  pass: {
    type: String,
    required: true
  },
  from: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.models.EmailSettings || mongoose.model('EmailSettings', emailSettingsSchema)
