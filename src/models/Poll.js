const mongoose = require('mongoose');

const PartySchema = new mongoose.Schema({
    name: { type: String, required: true },
    votes: { type: Number, default: 0 }
});

const PollSchema = new mongoose.Schema({
    pollId: { type: String, required: true, unique: true },
    parties: { type: [PartySchema], required: true },
});

module.exports = mongoose.model('Poll', PollSchema);