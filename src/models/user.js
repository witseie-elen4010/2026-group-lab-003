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
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
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
  }
}, {
  timestamps: true // Automatically adds 'createdAt' and 'updatedAt'
})

module.exports = mongoose.model('User', UserSchema)
