require('dotenv').config()
const path = require('path')

// Specific path for .env if needed
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

<<<<<<< Updated upstream
const app = require('./app')
const connectDB = require('../config/db')
=======
// Import the pre-configured Express app
const app = require('./app') 
const connectDB = require('./config/db')
>>>>>>> Stashed changes

const PORT = process.env.PORT || 3000

// Only start the database and server if we are NOT running tests
if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`)
      })
    })
    .catch((err) => {
      console.error(err)
    })
}

module.exports = app