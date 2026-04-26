const app = require('./app');
const connectDB = require('./config/db'); // 1. Import your database connection
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// 2. Connect to the database FIRST
connectDB().then(() => {
    // 3. Only start the server if the DB connects successfully
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
});