const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    
    lecturerId: { 
        type: String, 
        required: true 
    },
    startTime: { 
        type: String, 
        required: true 
    },
    endTime: { 
        type: String, 
        required: true 
    },

    module: {
        type: String,
        required: true,      
        trim: true           
    },
    // ==========================================

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;