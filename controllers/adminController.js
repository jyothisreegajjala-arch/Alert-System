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

// Delete user account permanently from database
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const isDbConnected = require('mongoose').connection.readyState === 1;
    const memoryStore = require('../config/memoryStore');
    let deletedUser = null;

    if (isDbConnected) {
      try {
        const mongoose = require('mongoose');
        const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);

        if (isValidObjectId) {
          deletedUser = await User.findById(userId);
        }
        if (!deletedUser) {
          deletedUser = await User.findOne({ $or: [{ _id: userId }, { email: userId }] });
        }

        if (deletedUser) {
          const userEmail = deletedUser.email;
          const userPhone = deletedUser.phone;
          const targetId = deletedUser._id;

          // 1. Permanently remove User document from MongoDB Atlas
          await User.deleteOne({ _id: targetId });

          // 2. Permanently remove all role profiles linked to this user
          await Neighbor.deleteMany({ $or: [{ userId: targetId }, { phone: userPhone }] });
          await SecurityGuard.deleteMany({ $or: [{ userId: targetId }, { phone: userPhone }] });
          await Volunteer.deleteMany({ $or: [{ userId: targetId }, { phone: userPhone }] });
          
          // 3. Permanently remove emergency contacts and connection requests
          const EmergencyContact = require('../models/EmergencyContact');
          const LinkRequest = require('../models/LinkRequest');
          await EmergencyContact.deleteMany({ $or: [{ userId: targetId }, { seniorUserId: targetId }] });
          await LinkRequest.deleteMany({
            $or: [
              { seniorUserId: targetId },
              { responderUserId: targetId },
              { targetEmail: userEmail },
              { targetPhone: userPhone }
            ]
          });

          // 4. Remove notifications linked to user
          try {
            const Notification = require('../models/Notification');
            await Notification.deleteMany({ $or: [{ userId: targetId }, { recipientId: targetId }] });
          } catch (e) {}

          console.log(`[Database Delete] User '${deletedUser.name}' (${deletedUser.email}) permanently removed from MongoDB.`);
        }
      } catch (dbErr) {
        console.error('[DB Delete User Error]:', dbErr.message);
      }
    }

    // Always ensure memoryStore is also purged of this user and their cached data
    const memIdx = memoryStore.users.findIndex(u =>
      (u._id && u._id.toString() === userId.toString()) ||
      (deletedUser && u.email === deletedUser.email)
    );

    if (memIdx !== -1) {
      const memUser = memoryStore.users[memIdx];
      memoryStore.users.splice(memIdx, 1);

      const targetMemId = memUser._id || userId;
      memoryStore.neighbors = memoryStore.neighbors.filter(n => n.userId !== targetMemId && (!memUser || n.phone !== memUser.phone));
      memoryStore.securityGuards = memoryStore.securityGuards.filter(g => g.userId !== targetMemId && (!memUser || g.phone !== memUser.phone));
      memoryStore.volunteers = memoryStore.volunteers.filter(v => v.userId !== targetMemId && (!memUser || v.phone !== memUser.phone));
      memoryStore.linkRequests = memoryStore.linkRequests.filter(r =>
        r.seniorUserId !== targetMemId &&
        r.responderUserId !== targetMemId &&
        (!memUser || (r.targetEmail !== memUser.email && r.targetPhone !== memUser.phone))
      );
      console.log(`[MemoryStore Delete] User '${memUser.name}' purged from memory cache.`);
    }

    if (!deletedUser && memIdx === -1) {
      if (isDbConnected) {
        try {
          const directDel = await User.findByIdAndDelete(userId);
          if (directDel) {
            await Neighbor.deleteMany({ userId });
            await SecurityGuard.deleteMany({ userId });
            await Volunteer.deleteMany({ userId });
            return res.status(200).json({ success: true, message: `User account '${directDel.name}' permanently deleted from MongoDB database.` });
          }
        } catch (e) {}
      }
      return res.status(404).json({ success: false, message: 'User account not found in database.' });
    }

    const userName = deletedUser ? deletedUser.name : 'User';
    return res.status(200).json({
      success: true,
      message: `User account '${userName}' permanently deleted from MongoDB database.`
    });
  } catch (err) {
    console.error('Delete User Controller Error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete user account: ' + err.message });
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

// Bulk Import Users & Emergency Alert Details from CSV Data (Stores into MongoDB / System Database)
exports.importUsersCSV = async (req, res) => {
  try {
    const { usersData } = req.body;
    if (!Array.isArray(usersData) || usersData.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or empty CSV dataset provided' });
    }

    const isDbConnected = require('mongoose').connection.readyState === 1;
    let importedUsersCount = 0;
    let importedEmergenciesCount = 0;
    const memoryStore = require('../config/memoryStore');

    for (const row of usersData) {
      // 1. Check if row is an Emergency Alert Detail record
      if (row.emergencyid || row['emergency id'] || row.seniorname || row['senior name']) {
        const seniorName = (row.seniorname || row['senior name'] || 'Senior Citizen').trim();
        const seniorPhone = (row.seniorphone || row['senior phone'] || '9876543210').trim();
        const seniorAddress = (row.address || row['senior address'] || 'Springboard Community').trim();
        const status = (row.status || 'RESOLVED').trim().toUpperCase();
        const responderName = (row.respondedby || row['responded by'] || row.respondername || 'Nearby Neighbor').trim();

        if (isDbConnected) {
          try {
            await Emergency.create({
              seniorName,
              seniorPhone,
              seniorAddress,
              status,
              responderName,
              isEscalatedToTier2: row.escalated === 'Yes',
              responseTimeSeconds: parseInt(row.responsetimeseconds || '12', 10) || 12
            });
            importedEmergenciesCount++;
          } catch (e) {
            console.error('[CSV Emergency Import Error]:', e.message);
          }
        } else {
          memoryStore.emergencies.push({
            _id: 'mem_em_' + Date.now() + Math.random().toString(36).substr(2, 4),
            emergencyId: 'EMG-' + Math.floor(1000 + Math.random() * 9000),
            seniorName,
            seniorPhone,
            seniorAddress,
            status,
            responderName,
            isEscalatedToTier2: row.escalated === 'Yes',
            responseTimeSeconds: 12,
            createdAt: new Date()
          });
          importedEmergenciesCount++;
        }
        continue;
      }

      // 2. Otherwise process User Detail record
      const email = (row.email || row['email address'] || '').trim().toLowerCase();
      if (!email) continue;

      const name = (row.name || row['full name'] || email.split('@')[0]).trim();
      const phone = (row.phone || row['phone number'] || ('98' + Math.floor(10000000 + Math.random() * 90000000))).trim();
      const password = (row.password || 'password123').trim();
      const rawRole = (row.role || row['user role'] || 'senior_citizen').trim().toLowerCase();

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

      const address = (row.address || row['street address'] || 'Springboard Community').trim();
      const apartmentNumber = (row.apartmentnumber || row['apartment number'] || row.apartment || 'A-101').trim();
      const medicalInfo = (row.medicalinfo || row['medical notes'] || row.medical || '').trim();

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
            importedUsersCount++;
          }
        } catch (dbErr) {
          console.error('[CSV User Import DB Error]:', dbErr.message);
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
          importedUsersCount++;
        }
      }
    }

    const totalImported = importedUsersCount + importedEmergenciesCount;
    return res.status(200).json({
      success: true,
      importedCount: totalImported,
      message: `CSV Import Complete: Successfully stored ${importedUsersCount} User details and ${importedEmergenciesCount} Emergency Alert details into database.`
    });
  } catch (err) {
    console.error('Import CSV error:', err);
    res.status(500).json({ success: false, message: 'Failed to import CSV file: ' + err.message });
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

// Export Combined Master CSV File (All User Details + All Emergency Alert Details into one CSV File)
exports.exportAllDataCSV = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let users = [];
    let emergencies = [];

    if (isDbConnected) {
      users = await User.find().select('-password').sort({ createdAt: -1 });
      emergencies = await Emergency.find().sort({ createdAt: -1 });
    } else {
      const memoryStore = require('../config/memoryStore');
      users = memoryStore.users;
      emergencies = memoryStore.emergencies;
    }

    let csvContent = '=== USER DETAILS DIRECTORY ===\n';
    csvContent += 'Name,Email,Phone,Role,Address,ApartmentNumber,Status,CreatedAt\n';
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

    csvContent += '\n=== EMERGENCY ALERT DETAILS LOGS ===\n';
    csvContent += 'EmergencyID,SeniorName,SeniorPhone,Address,Status,RespondedBy,Escalated,ResponseTimeSeconds,CreatedAt\n';
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
    res.setHeader('Content-Disposition', 'attachment; filename="safereach_master_users_and_emergencies.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Master export failed: ' + err.message });
  }
};
