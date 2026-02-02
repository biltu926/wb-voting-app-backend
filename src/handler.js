const serverless = require('serverless-http');
const app = require('./app');
const connectDB = require('./config/mongo');

const serverlessApp = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await connectDB(process.env.MONGO_URI);
    return serverlessApp(event, context);
}