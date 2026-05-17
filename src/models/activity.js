const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    type: String,
    description: String,
    user: String,
    userId: String,
    userEmail: String,
    userRole: String,
    metadata: Object,
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Activity', activitySchema);
