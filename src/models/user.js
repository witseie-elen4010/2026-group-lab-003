const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'Please add a name'] 
    },
    email: { 
        type: String, 
        required: [true, 'Please add an email'], 
        unique: true, // Prevents two users from signing up with the same email
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    role: { 
        type: String, 
        enum: ['student', 'lecturer'], // This explicitly satisfies the dual-role requirement
        default: 'student' 
    },
    password: { 
        type: String, 
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false // Security feature: prevents the password from being returned in standard queries
    }
}, { 
    timestamps: true // Automatically adds 'createdAt' and 'updatedAt'
});

module.exports = mongoose.model('User', UserSchema);