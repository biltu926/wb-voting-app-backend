const MongoStore = require('rate-limit-mongo');
const rateLimit = require('express-rate-limit');
const { softHash } = require('../utils/commonUtils');

exports.initLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    store: new MongoStore({
        uri: process.env.MONGO_URI,
        collectionName: 'rateLimits',
        expireTimeMs: 60 * 1000 // 1 minute
    }),
    keyGenerator: (req) => req.cookies.vote_token || softHash(req),
    message: {
        message: 'Too many init requests from this user, please try again later.'
    }
});

exports.voteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3,
    store: new MongoStore({
        uri: process.env.MONGO_URI,
        collectionName: 'rateLimits',
        expireTimeMs: 60 * 1000 // 1 minute
    }),
    keyGenerator: (req) => req.cookies.vote_token || softHash(req),
    message: {
        message: 'Too many vote requests from this user, please try again later.'
    }
});
