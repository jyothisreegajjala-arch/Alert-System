const mongoose = require('mongoose');
const dns = require('dns');
const config = require('./config');

try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Use default OS DNS resolution if setting custom servers is restricted
}

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return true;
  try {
    const conn = await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    isConnected = true;
    console.log(`[Database] SafeReach connected to Live MongoDB Atlas Cluster: ${conn.connection.host}`);
    return true;
  } catch (err) {
    console.error(`[Database] MongoDB Atlas Connection Error: ${err.message}`);
    console.log('[Database] Note: Ensure MONGO_URI in .env is configured with your MongoDB Atlas connection string.');
    return false;
  }
};

module.exports = connectDB;
