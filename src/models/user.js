const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add your name']
  },
  surname: {
    type: String,
    required: [true, 'Please add your surname']
  },
  idNumber: {
    type: String,
    required: [true, 'Please add your student or lecturer number'],
    unique: true, // Prevents two users from signing up with the same student number
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true, // Prevents two users from signing up with the same email
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please add a valid email'
    ]
  },
  role: {
    type: String,
    enum: ['student', 'lecturer'], // This explicitly satisfies the dual-role requirement
    default: 'student'
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 8,
    select: false // Security feature: prevents the password from being returned in standard queries
  },
  displayName: {
    type: String,
    default: '',
    trim: true,
    maxlength: 60
  },
  emailNotifications: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Automatically adds 'createdAt' and 'updatedAt'
})

module.exports = mongoose.model('User', UserSchema)
