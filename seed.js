const connectDB = require('./config/db');
const User = require('./models/User');
const Neighbor = require('./models/Neighbor');
const SecurityGuard = require('./models/SecurityGuard');
const Volunteer = require('./models/Volunteer');
const EmergencyContact = require('./models/EmergencyContact');
const Emergency = require('./models/Emergency');
const LinkRequest = require('./models/LinkRequest');

const wipeDatabase = async () => {
  try {
    const isConnected = await connectDB();
    if (!isConnected) {
      console.log('[Clean] Could not connect to MongoDB. Please check MONGO_URI.');
      process.exit(1);
    }

    console.log('[Clean] Purging all user accounts, login credentials, link requests, and emergency data from MongoDB...');
    const Notification = require('./models/Notification');
    await User.deleteMany({});
    await LinkRequest.deleteMany({});
    await Neighbor.deleteMany({});
    await SecurityGuard.deleteMany({});
    await Volunteer.deleteMany({});
    await EmergencyContact.deleteMany({});
    await Emergency.deleteMany({});
    try { await Notification.deleteMany({}); } catch (e) {}

    console.log('--------------------------------------------------');
    console.log('✅ ALL DATABASE DATA & LOGIN DETAILS REMOVED SUCCESSFULLY.');
    console.log('--------------------------------------------------');
    process.exit(0);
  } catch (err) {
    console.error('[Clean Error]:', err);
    process.exit(1);
  }
};

wipeDatabase();

