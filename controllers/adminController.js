const User = require('../models/User');
const Emergency = require('../models/Emergency');
const Neighbor = require('../models/Neighbor');
const SecurityGuard = require('../models/SecurityGuard');
const Volunteer = require('../models/Volunteer');
const memoryStore = require('../config/memoryStore');
const mongoose = require('mongoose');

const isDbConnected = () => mongoose.connection.readyState === 1;

// Get Admin Analytics & Metric Stats
exports.getStats = async (req, res) => {
  try {
    if (isDbConnected()) {
      const totalUsers = await User.countDocuments();
      const totalNeighbors = await Neighbor.countDocuments();
      const totalSecurityGuards = await SecurityGuard.countDocuments();
      const totalVolunteers = await Volunteer.countDocuments();
      const activeEmergencies = await Emergency.countDocuments({ status: { $in: ['PENDING_LOCAL', 'ACCEPTED', 'ESCALATED_VOLUNTEER'] } });
      const totalResolved = await Emergency.countDocuments({ status: 'RESOLVED' });
      const totalEmergencies = await Emergency.countDocuments();

      const acceptedEmergencies = await Emergency.find({ status: { $in: ['ACCEPTED', 'RESOLVED'] }, responseTimeSeconds: { $gt: 0 } });
      const totalResponseSec = acceptedEmergencies.reduce((acc, curr) => acc + (curr.responseTimeSeconds || 0), 0);
      const avgResponseTimeSec = acceptedEmergencies.length > 0 ? Math.round(totalResponseSec / acceptedEmergencies.length) : 0;

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
    } else {
      // Memory Store Stats
      const totalUsers = memoryStore.users.length;
      const totalNeighbors = memoryStore.neighbors.length;
      const totalSecurityGuards = memoryStore.securityGuards.length;
      const totalVolunteers = memoryStore.volunteers.length;
      const activeEmergencies = memoryStore.emergencies.filter(e => ['PENDING_LOCAL', 'ACCEPTED', 'ESCALATED_VOLUNTEER'].includes(e.status)).length;
      const totalResolved = memoryStore.emergencies.filter(e => e.status === 'RESOLVED').length;
      const totalEmergencies = memoryStore.emergencies.length;

      const acceptedEmergencies = memoryStore.emergencies.filter(e => ['ACCEPTED', 'RESOLVED'].includes(e.status) && e.responseTimeSeconds > 0);
      const totalResponseSec = acceptedEmergencies.reduce((acc, curr) => acc + (curr.responseTimeSeconds || 0), 0);
      const avgResponseTimeSec = acceptedEmergencies.length > 0 ? Math.round(totalResponseSec / acceptedEmergencies.length) : 24;

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
    }
  } catch (err) {
    console.error('Admin Stats Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats' });
  }
};

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;

    if (isDbConnected()) {
      let query = {};
      if (role && role !== 'all') query.role = role;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }
      const users = await User.find(query).select('-password').sort({ createdAt: -1 });
      return res.status(200).json({ success: true, count: users.length, users });
    } else {
      let filtered = [...memoryStore.users];
      if (role && role !== 'all') {
        filtered = filtered.filter(u => u.role === role);
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(u => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.phone.toLowerCase().includes(s));
      }
      return res.status(200).json({ success: true, count: filtered.length, users: filtered });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// Toggle user status
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    if (isDbConnected()) {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      user.active = !user.active;
      await user.save();
      return res.status(200).json({ success: true, message: `User status changed to ${user.active ? 'Active' : 'Deactivated'}`, user });
    } else {
      const user = memoryStore.users.find(u => u._id.toString() === userId.toString());
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      user.active = !user.active;
      return res.status(200).json({ success: true, message: `User status changed to ${user.active ? 'Active' : 'Deactivated'}`, user });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (isDbConnected()) {
      const user = await User.findByIdAndDelete(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      await Neighbor.deleteMany({ userId });
      await SecurityGuard.deleteMany({ userId });
      await Volunteer.deleteMany({ userId });
      return res.status(200).json({ success: true, message: 'User deleted' });
    } else {
      const idx = memoryStore.users.findIndex(u => u._id.toString() === userId.toString());
      if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
      memoryStore.users.splice(idx, 1);
      return res.status(200).json({ success: true, message: 'User deleted' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

// Emergency Reports
exports.getEmergencyReports = async (req, res) => {
  try {
    if (isDbConnected()) {
      const emergencies = await Emergency.find().sort({ createdAt: -1 });
      return res.status(200).json({ success: true, emergencies });
    } else {
      return res.status(200).json({ success: true, emergencies: memoryStore.emergencies });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};
