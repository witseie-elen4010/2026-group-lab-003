require('dotenv').config();

const path = require('path');
// This finds the .env file in the parent directory of 'src'
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const connectDB = require('./config/db'); // 1. Import your database connection

const PORT = process.env.PORT || 3000;

// 2. Connect to the database FIRST
connectDB().then(() => {
    // 3. Only start the server if the DB connects successfully
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
});