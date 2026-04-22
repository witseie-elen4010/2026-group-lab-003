const express = require('express')
const app = express()
app.use(express.json()) // Essential for reading JSON in Login/Registration

app.get('/', (req, res) => {
  res.send('Consultation Scheduler API is running...')
})

module.exports = app
