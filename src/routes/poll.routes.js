const router = require('express').Router();
const controller = require('../controllers/poll.controller');
const { initLimiter, voteLimiter } = require('../middleware/rateLimit');

router.post("/vote", voteLimiter, controller.votePoll);
router.get("/result", controller.pollResults);
router.post("/init", initLimiter, controller.initPoll);

module.exports = router;