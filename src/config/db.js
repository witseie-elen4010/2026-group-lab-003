const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // This line securely fetches your password from the .env file
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Database connection error: ${error.message}`);
        // Exit process with failure so the app doesn't run in a broken state
        process.exit(1); 
    }
};

module.exports = connectDB;