const crypto = require('crypto');
const Poll = require('../models/Poll');
const Access = require('../models/Access');
const mongoose = require('mongoose');
const { softHash } = require('../utils/commonUtils');

/** This would map to a mongo collection named PollAccess */
const PollAccess = mongoose.models.Access || mongoose.model('PollAccess', Access);

/** POST /api/poll/init
 * Checks whether an user can vote in a poll.
 */
exports.initPoll = async (req, res) => {
    // console.log('=== INIT POLL START ===');
    // console.log('Request body:', JSON.stringify(req.body));
    // console.log('Request cookies:', JSON.stringify(req.cookies));
    // console.log('Request headers:', JSON.stringify(req.headers));
    
    const { pollId, deviceId } = req.body;

    if(!deviceId){
        console.log('ERROR: Device ID missing');
        return res.status(400).json({ message: 'Device ID is required.' });
    }
    
    console.log('Checking for existing vote:', { pollId, deviceId });
    
    try {
        const existing = await PollAccess.findOne({ pollId, deviceId, used: true });
        console.log('Existing vote check result:', existing ? 'FOUND - User already voted' : 'NOT FOUND - User can vote');
        
        if (existing) {
            console.log('Existing vote details:', JSON.stringify(existing));
            return res.status(403).json({ message: 'Device has already voted in this poll.' });
        }

        // Check if the browser already has a voteToken cookie but not voted yet
        const existingVoteToken = req.cookies.vote_token;
        console.log('Existing vote token from cookie:', existingVoteToken || 'NONE');
        
        if (existingVoteToken) {
            console.log('Looking up token in database:', existingVoteToken);
            const tokenDoc = await PollAccess.findOne({
                pollId,
                voteToken: existingVoteToken
            });
            console.log('Token lookup result:', tokenDoc ? 'FOUND' : 'NOT FOUND');
            
            if(tokenDoc){
                console.log('Token doc details:', JSON.stringify(tokenDoc));
                console.log('=== INIT POLL END - Token valid, user can vote ===');
                return res.json({ allowed: true });
            }
        }

        // Generate a new vote token
        const voteToken = crypto.randomUUID();
        console.log('Generated new vote token:', voteToken);
        
        const accessDoc = { 
            pollId, 
            deviceId, 
            voteToken,
            softHash: softHash(req),
            used: false
        };
        console.log('Creating new access document:', JSON.stringify(accessDoc));
        
        const created = await PollAccess.create(accessDoc);
        console.log('Access document created successfully:', created._id);

        // Cookies aren't working with Lambda Functions
        res.cookie("vote_token", voteToken, {
            httpOnly: true,
            sameSite: "none",
            secure: true,
            maxAge: 90 * 24 * 60 * 60 * 1000
        });
        
        console.log('=== INIT POLL END - Success ===');
        return res.json({ allowed: true, voteToken });
        
    } catch (error) {
        console.error('ERROR in initPoll:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

/** POST /api/poll/vote
 * Cast a vote for a party in a poll.
 */
exports.votePoll = async (req, res) => {
    // console.log('=== VOTE POLL START ===');
    // console.log('Request body:', JSON.stringify(req.body));
    // console.log('Request cookies:', JSON.stringify(req.cookies));
    
    const { pollId, partyName } = req.body;
    const token = req.headers['X-Vote-Token'] || req.cookies?.vote_token;

    if(!token){
        console.log('ERROR:  from cookies');
        return res.status(401).json({ message: 'Vote token is missing. Please initialize voting first.' });
    }
    
    if (!partyName) {
        console.log('ERROR: Party name missing');
        return res.status(400).json({ message: 'Party name is required to cast a vote.' });
    }

    console.log('Vote details:', { pollId, partyName, token });
    
    let session;
    try {
        console.log('Starting MongoDB transaction...');
        session = await mongoose.startSession();
        session.startTransaction();
        console.log('Transaction started');

        // For this pollId, and token find if the vote has already been cast
        console.log('Looking up access document:', { pollId, token });
        const access = await PollAccess.findOne(
            { pollId, voteToken: token },
            null,
            { session }
        );

        if (!access) {
            console.log('ERROR: Access document not found - invalid token');
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({ message: 'Invalid vote token for this poll.' });
        }
        
        console.log('Access document found:', JSON.stringify(access));

        if (access.used) {
            console.log('ERROR: Token already used');
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'This vote token has already been used.' });
        }

        // Cast the vote
        console.log('Attempting to cast vote for party:', partyName);
        const poll = await Poll.updateOne(
            { pollId, "parties.name": partyName },
            { 
                $inc: { "parties.$.votes": 1 } 
            },
            { session }
        );

        console.log('Poll update result:', JSON.stringify(poll));

        if(poll.modifiedCount != 1){
            console.log('ERROR: Failed to update poll - modifiedCount:', poll.modifiedCount);
            throw new Error('Failed to cast vote. Party or Poll not found.');
        }

        console.log('Marking access token as used');
        access.used = true;
        await access.save({ session });
        console.log('Access token marked as used');

        console.log('Committing transaction...');
        await session.commitTransaction();
        console.log('Transaction committed successfully');
        
        console.log('=== VOTE POLL END - Success ===');
        return res.json({ success: true });

    } catch (e) {
        console.error('ERROR in votePoll:', {
            message: e.message,
            stack: e.stack,
            name: e.name
        });
        
        if (session) {
            console.log('Aborting transaction due to error');
            await session.abortTransaction();
        }
        return res.status(500).json({ message: e.message });
    } finally {
        if (session) {
            console.log('Ending session');
            session.endSession();
        }
    }
};

/** GET /api/poll/result
 * Get the current results of a poll.
 */
exports.pollResults = async (req, res) => {
    console.log('=== POLL RESULTS START ===');
    console.log('Query params:', JSON.stringify(req.query));
    
    const pollId = req.query.pollId;
    
    if (!pollId) {
        console.log('ERROR: Poll ID missing from query');
        return res.status(400).json({ message: 'Poll ID is required' });
    }
    
    try {
        console.log('Fetching poll results for:', pollId);
        const poll = await Poll.aggregate([
            { $match: { pollId: "wb-2026" } },
            {
              $project: {
                _id: 0,
                parties: 1,
                totalVotes: { $sum: "$parties.votes" }
              }
            }
          ]
        );
        
        if (!poll) {
            console.log('ERROR: Poll not found:', pollId);
            return res.status(404).json({ message: 'Poll not found' });
        }
        
        console.log('Poll results found:', JSON.stringify(poll));
        console.log('=== POLL RESULTS END - Success ===');
        
        res.json(poll);
    } catch (error) {
        console.error('ERROR in pollResults:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}