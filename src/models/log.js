const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
    userEmail: { 
        type: String, 
        required: true 
    },
    action: { 
        type: String, 
        required: true // e.g., "Logged In", "Booked Consultation"
    },
    details: { 
        type: String 
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Log', LogSchema);