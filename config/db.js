const mongoose = require('mongoose');
const dns = require('dns');
const config = require('./config');

if (process.platform === 'win32' && !process.env.VERCEL) {
  try {
    dns.setDefaultResultOrder('ipv4first');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (e) {}
}

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) return true;
  try {
    const conn = await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000
    });
    isConnected = true;
    console.log(`[Database] SafeReach connected to Live MongoDB Atlas Cluster: ${conn.connection.host}`);
    return true;
  } catch (err) {
    isConnected = false;
    console.error(`[Database] MongoDB Atlas Connection Error: ${err.message}`);
    return false;
  }
};

module.exports = connectDB;
