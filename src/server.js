require('dotenv').config()
const path = require('path')
// Specific path for .env if needed
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const app = require('./app')
const connectDB = require('../config/db')

const PORT = process.env.PORT || 3000

// Connect to the database FIRST
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Failed to connect to DB, server not started:', err)
  })
