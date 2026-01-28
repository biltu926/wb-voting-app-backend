const serverless = require('serverless-http');
const app = require('./app');
const connectDB = require('./config/mongo');


module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await connectDB();
    return serverless(app)(event, context);
}