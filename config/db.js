const mongoose = require('mongoose');
const dns = require('dns');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('./config');

if (process.platform === 'win32' && !process.env.VERCEL) {
  try {
    dns.setDefaultResultOrder('ipv4first');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (e) {}
}

const DEFAULT_ATLAS_URI = 'mongodb+srv://jyothisreegajjala_db_user:Chitti%407739@cluster0.gvxao6d.mongodb.net/safereach?retryWrites=true&w=majority&appName=Cluster0';

// Global cache for serverless environments (Vercel)
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// Enable standard Mongoose buffering so queries wait briefly for connection establishment
mongoose.set('bufferCommands', true);

let mongoServer = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return true;

  if (cached.conn && mongoose.connection.readyState === 1) {
    return true;
  }

  const targetUri = process.env.MONGO_URI || config.MONGO_URI || DEFAULT_ATLAS_URI;

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      bufferCommands: true
    };

    cached.promise = mongoose.connect(targetUri, opts).then((mongooseInstance) => {
      console.log(`[Database] SafeReach connected to Live MongoDB: ${mongooseInstance.connection.host}`);
      return mongooseInstance;
    }).catch((err) => {
      console.error(`[Database] Connection error: ${err.message}`);
      cached.promise = null;
      return null;
    });
  }

  try {
    cached.conn = await cached.promise;
    if (cached.conn && mongoose.connection.readyState === 1) {
      return true;
    }
  } catch (e) {
    cached.promise = null;
  }

  // Fallback for local MongoMemoryServer if Atlas is unreachable and NOT on Vercel
  if (!process.env.VERCEL) {
    try {
      if (!mongoServer) {
        console.log('[Database] Starting in-memory MongoMemoryServer database...');
        mongoServer = await MongoMemoryServer.create();
        const memoryUri = mongoServer.getUri();
        await mongoose.connect(memoryUri);
        console.log(`[Database] SafeReach connected to MongoMemoryServer at ${memoryUri}`);
        return true;
      }
    } catch (memErr) {
      console.error(`[Database] MongoMemoryServer launch error: ${memErr.message}`);
    }
  }

  return mongoose.connection.readyState === 1;
};

module.exports = connectDB;

