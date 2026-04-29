const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const saltRounds = 10
const path = require('path')
const User = require('./models/user')
const console = require('console')

// --- Middleware ---
app.use(express.json())

// --- Default Route ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing-page.html'))
})

app.use(express.static(path.join(__dirname, '../public')))

// --- Registration Route ---
app.post('/api/register', async (req, res) => {
  try {
    const { name, surname, idNumber, email, role, password } = req.body

    // Basic validation
    if (!email || !password || !idNumber) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const user = await User.create({
      name,
      surname,
      idNumber,
      email,
      role,
      password: hashedPassword
    })

    console.log('User registered in DB:', user.email)
    res.status(201).json({ success: true, message: 'User registered!' })
  } catch (err) {
    console.error('Registration Error:', err.message)
    res.status(400).json({ success: false, error: err.message })
  }
})

// --- Login Route ---
app.post('/api/login', async (req, res) => {
  console.log('--- Login Attempt Start ---')
  try {
    const { email, password } = req.body
    console.log('1. Data received:', email)

    // Find user and include the password field (since it's hidden in schema)
    const user = await User.findOne({ email }).select('+password').lean()
    console.log('2. Database query finished. User found?', !!user)

    // Check if user exists in the database
    if (!user) {
      console.log('3 STOP: User not found in database.')
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    console.log('User from DB:', user)
    console.log('4. About to check bcrypt. Password from DB exists?', !!user.password)

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password)
    console.log('5. Bcrypt compare finished. Match?', isMatch)

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    console.log('6. Login successful, sending response.')
    res.status(200).json({
      success: true,
      message: 'Login successful!',
      user: { name: user.name, role: user.role }
    })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error during login.' })
  }
})

module.exports = app
