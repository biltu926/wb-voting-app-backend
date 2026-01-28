const router = require('express').Router();
const controller = require('../controllers/poll.controller');

router.post("/vote", controller.votePoll);
router.get("/result", controller.pollResults);
router.post("/init", controller.initPoll);

module.exports = router;