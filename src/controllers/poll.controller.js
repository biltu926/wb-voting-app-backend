
const crypto = require('crypto');
const Poll = require('../models/Poll');
const Access = require('../models/Access');
const mongoose = require('mongoose');

function getClientIp(req) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        return ips[0];
    }
    return req.connection.remoteAddress;
};

function softHash(req) {
    return crypto.createHash("sha256").update(
        [
            getClientIp(req)?.split(".").slice(0, 3).join("."), // /24 subnet
            req.headers['user-agent']?.split(")")[0],
            req.headers['accept-language']
          ].join("|")
    ).digest('hex');
};

/** This would map to a mongo collection named PollAccess */
const PollAccess = mongoose.models.Access || mongoose.model('PollAccess', Access);

/** POST /api/poll/init
 * Checks whether an user can vote in a poll.
 */
exports.initPoll = async (req, res) => {
    const { pollId, deviceId } = req.body;

    if(!deviceId){
        return res.status(400).json({ message: 'Device ID is required.' });
    }
    // What if a wrong pollId is sent?
    
    const existing = await PollAccess.findOne({ pollId, deviceId });
    if (existing) {
        return res.status(403).json({ message: 'Device has already voted in this poll.' });
    }

    // Check if the browser already has a voteToken cookie but not voted yet
    const existingVoteToken = req.cookies.vote_token;
    if (existingVoteToken) {
        const tokenDoc = await PollAccess.findOne(
            {
                pollId,
                voteToken: existingVoteToken
            }
        );
        if(tokenDoc){
            return res.json({ allowed: true });// User can vote
        }
    }

    // Generate a new vote token
    const voteToken = crypto.randomUUID();
    await PollAccess.create({ 
        pollId, 
        deviceId, 
        voteToken,
        softHash: softHash(req),
        used: false
     });

    res.cookie("vote_token", voteToken, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 90 * 24 * 60 * 60 * 1000
      });
    
    return res.json({ allowed: true });

};

/** POST /api/poll/vote
 * Cast a vote for a party in a poll.
 */

exports.votePoll = async (req, res) => {
    const { pollId, partyName } = req.body;
    const token = req.cookies.vote_token;

    if(!token){
        return res.status(401).json({ message: 'Vote token is missing. Please initialize voting first.' });
    }
    if (!partyName) {
        return res.status(400).json({ message: 'Party name is required to cast a vote.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try{
        // For this pollId, and token find if the vote has already been cats
        const access = await PollAccess.findOne(
            { pollId, voteToken: token },
            null,
            { session }
        );

        if (!access) {
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({ message: 'Invalid vote token for this poll.' });
        }

        if (access.used) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'This vote token has already been used.' });
        }

        // Cast the vote
        const poll = await Poll.updateOne(
            { pollId, "parties.name": partyName },
            { 
                $inc: { "parties.$.votes": 1 } 
            },
            { session }
        );

        if(poll.modifiedCount != 1){
            throw new Error('Failed to cast vote. Party or Poll not found.');
        }

        access.used = true;
        await access.save({ session });


        await session.commitTransaction();
        return res.json({ success: true });

    }
    catch (e) {
        await session.abortTransaction();
        return res.status(403).json({ message: e.message });
      } finally {
        session.endSession();
      }
};

/** GET /api/poll/result
 * Get the current results of a poll.
 */

exports.pollResults = async (req, res) => {
    const pollId = req.query.pollId;
    const poll = await Poll.findOne(
        { pollId },
        { _id: 0, parties: 1, totalVotes: { $sum: "$parties.votes" } }
    )

    res.json(poll);
}