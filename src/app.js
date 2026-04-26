const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const saltRounds = 10 // This determines how strong the hash is
const path = require('path')

// Temporary in-memory user store
const users = []

app.use(express.json()) // Essential for reading JSON in Login/Registration

app.use(express.static('../public'))

// For registration
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' })

    const hashedPassword = await bcrypt.hash(password, saltRounds)
    const newUser = { username, password: hashedPassword }

    users.push(newUser)
    console.log('User registered:', newUser) // Helpful for debugging
    res.status(201).json({ message: 'User created successfully' })
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' })
  }
})

// For login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    // Ensure both fields are present
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    // Find the user in the temporary array
    const user = users.find(u => u.username === username)

    // If user doesn't exist OR password doesn't match
    // Note: We use the same error for both to prevent "Username Enumeration"
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    res.status(200).json({
      message: 'Login successful!',
      user: user.username
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error during login.' })
  }
})

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login-page.html'))
})

module.exports = app
