const User = require('../models/User');
const Emergency = require('../models/Emergency');
const Neighbor = require('../models/Neighbor');
const SecurityGuard = require('../models/SecurityGuard');
const Volunteer = require('../models/Volunteer');

// Get Admin Analytics & Metric Stats
exports.getStats = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let totalUsers = 0, totalNeighbors = 0, totalSecurityGuards = 0, totalVolunteers = 0;
    let activeEmergencies = 0, totalResolved = 0, totalEmergencies = 0, avgResponseTimeSec = 0;

    if (isDbConnected) {
      totalUsers = await User.countDocuments();
      totalNeighbors = await Neighbor.countDocuments();
      totalSecurityGuards = await SecurityGuard.countDocuments();
      totalVolunteers = await Volunteer.countDocuments();
      activeEmergencies = await Emergency.countDocuments({ status: { $in: ['PENDING_LOCAL', 'ACCEPTED', 'ESCALATED_VOLUNTEER'] } });
      totalResolved = await Emergency.countDocuments({ status: 'RESOLVED' });
      totalEmergencies = await Emergency.countDocuments();

      const acceptedEmergencies = await Emergency.find({ status: { $in: ['ACCEPTED', 'RESOLVED'] }, responseTimeSeconds: { $gt: 0 } });
      const totalResponseSec = acceptedEmergencies.reduce((acc, curr) => acc + (curr.responseTimeSeconds || 0), 0);
      avgResponseTimeSec = acceptedEmergencies.length > 0 ? Math.round(totalResponseSec / acceptedEmergencies.length) : 0;
    } else {
      const memoryStore = require('../config/memoryStore');
      totalUsers = memoryStore.users.length;
      totalNeighbors = memoryStore.neighbors.length;
      totalSecurityGuards = memoryStore.securityGuards.length;
      totalVolunteers = memoryStore.volunteers.length;
      activeEmergencies = memoryStore.emergencies.filter(e => ['PENDING_LOCAL', 'ACCEPTED', 'ESCALATED_VOLUNTEER'].includes(e.status)).length;
      totalResolved = memoryStore.emergencies.filter(e => e.status === 'RESOLVED').length;
      totalEmergencies = memoryStore.emergencies.length;
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalNeighbors,
        totalSecurityGuards,
        totalVolunteers,
        activeEmergencies,
        totalResolved,
        totalEmergencies,
        avgResponseTimeSec
      }
    });
  } catch (err) {
    console.error('Admin Stats Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats' });
  }
};

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let users = [];

    if (isDbConnected) {
      let query = {};
      if (role && role !== 'all') query.role = role;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }
      users = await User.find(query).select('-password').sort({ createdAt: -1 });
    } else {
      const memoryStore = require('../config/memoryStore');
      users = memoryStore.users;
      if (role && role !== 'all') users = users.filter(u => u.role === role);
      if (search) {
        const s = search.toLowerCase();
        users = users.filter(u => (u.name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s) || (u.phone || '').includes(s));
      }
    }
    return res.status(200).json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// Toggle user status
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let user;

    if (isDbConnected) {
      user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      user.active = !user.active;
      await user.save();
    } else {
      const memoryStore = require('../config/memoryStore');
      user = memoryStore.users.find(u => u._id.toString() === userId.toString());
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      user.active = !user.active;
    }
    return res.status(200).json({ success: true, message: `User status changed to ${user.active ? 'Active' : 'Deactivated'}`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const isDbConnected = require('mongoose').connection.readyState === 1;

    if (isDbConnected) {
      const user = await User.findByIdAndDelete(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      await Neighbor.deleteMany({ userId });
      await SecurityGuard.deleteMany({ userId });
      await Volunteer.deleteMany({ userId });
    } else {
      const memoryStore = require('../config/memoryStore');
      const idx = memoryStore.users.findIndex(u => u._id.toString() === userId.toString());
      if (idx !== -1) memoryStore.users.splice(idx, 1);
    }
    return res.status(200).json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

// Emergency Reports
exports.getEmergencyReports = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let emergencies = [];
    if (isDbConnected) {
      emergencies = await Emergency.find().sort({ createdAt: -1 });
    } else {
      const memoryStore = require('../config/memoryStore');
      emergencies = memoryStore.emergencies;
    }
    return res.status(200).json({ success: true, emergencies });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};
