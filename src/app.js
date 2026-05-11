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

const bookingRoutes = require('./routes/bookings')
app.use(express.json())

app.use(express.static('public'))

app.use('/api/bookings', bookingRoutes)

// password-reset
const authRoutes = require('./routes/auth')
app.use('/api/auth', authRoutes)

// --- Course Routes ---
const courseRoutes = require('./routes/courses');
app.use('/api/courses', courseRoutes);

// --- Schedule Routes ---
const scheduleRoutes = require('./routes/schedules');
app.use('/api/schedules', scheduleRoutes);

// --- Registration Route ---
app.post('/api/register', async (req, res) => {
  try {
    const { name, surname, idNumber, email, role, password } = req.body

    // Basic validation
    if (!email || !password || !idNumber) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    // Check for duplicates
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email is already registered' })
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const user = new User({
      name,
      surname,
      idNumber,
      email,
      role,
      password: hashedPassword
    })

    await user.save();
    console.log('User registered in DB:', user.email); // This will now show the actual email
    res.status(201).json({ success: true, message: 'User registered!' });

    console.log('User registered in DB:', user.email)
    res.status(201).json({ success: true, message: 'User registered!' })
  } catch (err) {
    console.error('Registration Error:', err.message)
    res.status(400).json({ success: false, error: err.message })
  }
})

// --- Login Route ---
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user and include the password field (since it's hidden in schema)
    const user = await User.findOne({ email }).select('+password').lean()

    // Check if user exists in the database
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      user: { name: user.name, surname: user.surname, idNumber: user.idNumber, role: user.role }
    })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error during login.' })
  }
})

// --- Profile Routes ---
app.get('/api/profile', async (req, res) => {
  const user = await User.findOne({ email: req.headers['x-user-email'] }).select('name surname email notificationsEnabled');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  res.json({ success: true, user });
});

app.put('/api/profile', async (req, res) => {
  const email = req.headers['x-user-email'];
  const { name, surname, notificationsEnabled } = req.body;
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { name, surname, notificationsEnabled } },
    { new: true, select: 'name surname email notificationsEnabled' }
  );
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  res.json({ success: true, message: 'Profile updated.', user });
});


module.exports = app
