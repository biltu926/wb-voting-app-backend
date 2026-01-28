const mongoose = require('mongoose');

const AccessSchema = new mongoose.Schema({
    pollId: { type: String, required: true },
    deviceId: { type: String, required: true },
    voteToken: {type: String, required: true },
    softHash: { type: String, required: true },
    used: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Access', AccessSchema);