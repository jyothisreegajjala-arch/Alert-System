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

// Bulk Import Users from CSV Data (Stores into MongoDB / System Database)
exports.importUsersCSV = async (req, res) => {
  try {
    const { usersData } = req.body;
    if (!Array.isArray(usersData) || usersData.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or empty CSV dataset provided' });
    }

    const isDbConnected = require('mongoose').connection.readyState === 1;
    let importedCount = 0;
    const memoryStore = require('../config/memoryStore');

    for (const u of usersData) {
      const email = (u.email || u['email address'] || '').trim().toLowerCase();
      if (!email) continue;

      const name = (u.name || u['full name'] || email.split('@')[0]).trim();
      const phone = (u.phone || u['phone number'] || ('98' + Math.floor(10000000 + Math.random() * 90000000))).trim();
      const password = (u.password || 'password123').trim();
      const rawRole = (u.role || u['user role'] || 'senior_citizen').trim().toLowerCase();

      let role = 'senior_citizen';
      if (['senior_citizen', 'child', 'family_member', 'neighbor', 'security_guard', 'volunteer', 'admin'].includes(rawRole)) {
        role = rawRole;
      } else if (rawRole.includes('senior')) role = 'senior_citizen';
      else if (rawRole.includes('child')) role = 'child';
      else if (rawRole.includes('family') || rawRole.includes('guardian')) role = 'family_member';
      else if (rawRole.includes('neighbor')) role = 'neighbor';
      else if (rawRole.includes('security') || rawRole.includes('guard')) role = 'security_guard';
      else if (rawRole.includes('volunteer')) role = 'volunteer';
      else if (rawRole.includes('admin')) role = 'admin';

      const address = (u.address || u['street address'] || 'Springboard Community').trim();
      const apartmentNumber = (u.apartmentnumber || u['apartment number'] || u.apartment || 'A-101').trim();
      const medicalInfo = (u.medicalinfo || u['medical notes'] || u.medical || '').trim();

      if (isDbConnected) {
        try {
          const exists = await User.findOne({ email });
          if (!exists) {
            const created = await User.create({
              name, email, phone, password, role, address, apartmentNumber, medicalInfo, active: true
            });
            if (role === 'neighbor') {
              await Neighbor.create({ userId: created._id, name, phone, address, apartmentNumber });
            } else if (role === 'security_guard') {
              await SecurityGuard.create({ userId: created._id, name, phone, apartment: apartmentNumber, dutyStatus: 'ON_DUTY' });
            } else if (role === 'volunteer') {
              await Volunteer.create({ userId: created._id, name, phone, address, availability: 'AVAILABLE' });
            }
            importedCount++;
          }
        } catch (dbErr) {
          console.error('[CSV Import DB Error]:', dbErr.message);
        }
      } else {
        const exists = memoryStore.users.find(m => m.email === email);
        if (!exists) {
          const memUser = {
            _id: 'mem_user_' + Date.now() + Math.random().toString(36).substr(2, 4),
            name, email, phone, password, rawPassword: password, role, address, apartmentNumber, medicalInfo, active: true
          };
          memoryStore.users.push(memUser);
          if (role === 'neighbor') memoryStore.neighbors.push({ _id: 'mem_n_' + Date.now(), userId: memUser._id, name, phone, address, apartmentNumber });
          if (role === 'security_guard') memoryStore.securityGuards.push({ _id: 'mem_g_' + Date.now(), userId: memUser._id, name, phone, apartment: apartmentNumber, dutyStatus: 'ON_DUTY' });
          if (role === 'volunteer') memoryStore.volunteers.push({ _id: 'mem_v_' + Date.now(), userId: memUser._id, name, phone, address, availability: 'AVAILABLE' });
          importedCount++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      importedCount,
      message: `Successfully imported ${importedCount} records from CSV into system database.`
    });
  } catch (err) {
    console.error('Import CSV error:', err);
    res.status(500).json({ success: false, message: 'Failed to import CSV data: ' + err.message });
  }
};

// Export Users Directory CSV (Formatted for Excel)
exports.exportUsersCSV = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let users = [];
    if (isDbConnected) {
      users = await User.find().select('-password').sort({ createdAt: -1 });
    } else {
      const memoryStore = require('../config/memoryStore');
      users = memoryStore.users;
    }

    let csvContent = 'Name,Email,Phone,Role,Address,ApartmentNumber,Status,CreatedAt\n';
    users.forEach(u => {
      const name = `"${(u.name || '').replace(/"/g, '""')}"`;
      const email = `"${(u.email || '').replace(/"/g, '""')}"`;
      const phone = `"${(u.phone || '').replace(/"/g, '""')}"`;
      const role = `"${(u.role || '').replace(/"/g, '""')}"`;
      const address = `"${(u.address || '').replace(/"/g, '""')}"`;
      const apt = `"${(u.apartmentNumber || '').replace(/"/g, '""')}"`;
      const status = u.active ? 'Active' : 'Deactivated';
      const created = u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString();
      csvContent += `${name},${email},${phone},${role},${address},${apt},${status},${created}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="safereach_users_directory.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed: ' + err.message });
  }
};

// Export Emergency Logs CSV (Formatted for Excel)
exports.exportEmergenciesCSV = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let emergencies = [];
    if (isDbConnected) {
      emergencies = await Emergency.find().sort({ createdAt: -1 });
    } else {
      const memoryStore = require('../config/memoryStore');
      emergencies = memoryStore.emergencies;
    }

    let csvContent = 'EmergencyID,SeniorName,SeniorPhone,Address,Status,RespondedBy,Escalated,ResponseTimeSeconds,CreatedAt\n';
    emergencies.forEach(e => {
      const id = `"${(e.emergencyId || e._id || '').toString().replace(/"/g, '""')}"`;
      const name = `"${(e.seniorName || '').replace(/"/g, '""')}"`;
      const phone = `"${(e.seniorPhone || '').replace(/"/g, '""')}"`;
      const address = `"${(e.seniorAddress || '').replace(/"/g, '""')}"`;
      const status = `"${(e.status || '').replace(/"/g, '""')}"`;
      const resp = `"${(e.responderName || '').replace(/"/g, '""')}"`;
      const esc = e.isEscalatedToTier2 ? 'Yes' : 'No';
      const timeSec = e.responseTimeSeconds || 0;
      const created = e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString();
      csvContent += `${id},${name},${phone},${address},${status},${resp},${esc},${timeSec},${created}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="safereach_emergency_logs.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed: ' + err.message });
  }
};
