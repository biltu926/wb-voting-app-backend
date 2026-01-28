const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

module.exports = async function connectDB(uri){

    if (cached.conn) return cached.conn;

    if (!cached.promise){
        cached.promise = mongoose.connect(uri, {
            bufferCommands: false
        }).then((mongoose => mongoose));
}
    cached.conn = await cached.promise;
    return cached.conn;
}