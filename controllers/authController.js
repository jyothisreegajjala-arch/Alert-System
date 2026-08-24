const User = require('../models/User');
const Neighbor = require('../models/Neighbor');
const SecurityGuard = require('../models/SecurityGuard');
const Volunteer = require('../models/Volunteer');
const LinkRequest = require('../models/LinkRequest');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

const generateToken = (id) => {
  return jwt.sign({ id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
};

// Register user
// Register user
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, address, apartmentNumber, latitude, longitude, medicalInfo } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const connectDB = require('../config/db');
    await connectDB();

    const memoryStore = require('../config/memoryStore');
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let user = null;

    const userPhone = phone ? phone.trim() : ('98' + Math.floor(10000000 + Math.random() * 90000000));
    const existingMemUser = memoryStore.users.find(u => u.email === cleanEmail || (u.phone && u.phone === userPhone));

    // 1. Check if user already exists in MongoDB
    let existingUser = null;
    try {
      existingUser = await User.findOne({
        $or: [
          { email: cleanEmail },
          { phone: userPhone }
        ]
      });
    } catch (e) {
      console.warn('[DB Find Existing Error]:', e.message);
    }

    if (existingUser || existingMemUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address or phone number is already registered. Please sign in.'
      });
    }

    // 2. Create user in MongoDB Atlas (or fallback to Memory Store if DB disconnected/errored)
    if (require('mongoose').connection.readyState === 1) {
      try {
        user = await User.create({
          name: name || cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: userPhone,
          password: cleanPassword,
          role: role || 'senior_citizen',
          address: address || 'Springboard Community',
          apartmentNumber: apartmentNumber || 'A-101',
          latitude: latitude || 12.9716,
          longitude: longitude || 77.5946,
          medicalInfo: medicalInfo || '',
          active: true
        });

        if (role === 'neighbor') {
          await Neighbor.create({ userId: user._id, name: user.name, phone: user.phone, address: user.address, apartmentNumber: user.apartmentNumber });
        } else if (role === 'security_guard') {
          await SecurityGuard.create({ userId: user._id, name: user.name, phone: user.phone, apartment: user.apartmentNumber, dutyStatus: 'ON_DUTY' });
        } else if (role === 'volunteer') {
          await Volunteer.create({ userId: user._id, name: user.name, phone: user.phone, address: user.address, availability: 'AVAILABLE' });
        }
        console.log(`[Database Register Success] User '${user.name}' (${user.email}) stored in MongoDB Atlas.`);
      } catch (dbErr) {
        console.error('[DB Register Error]:', dbErr.message);
        if (dbErr.code === 11000) {
          return res.status(400).json({ success: false, message: 'An account with this email address or phone number is already registered. Please sign in.' });
        }
        user = null;
      }
    }

    // 3. Fallback to memoryStore user creation if DB registration was not completed
    if (!user) {
      console.log(`[MemoryStore Register Fallback] Storing user '${cleanEmail}' in memoryStore...`);
      const memUserObj = {
        _id: 'mem_' + Date.now() + Math.random().toString(36).substr(2, 5),
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: userPhone,
        password: cleanPassword,
        rawPassword: cleanPassword,
        role: role || 'senior_citizen',
        address: address || 'Springboard Community',
        apartmentNumber: apartmentNumber || 'A-101',
        latitude: latitude || 12.9716,
        longitude: longitude || 77.5946,
        medicalInfo: medicalInfo || '',
        active: true,
        createdAt: new Date()
      };
      user = memUserObj;
    }

    // 3. Keep memoryStore in sync with MongoDB created user
    const userObj = user.toObject ? user.toObject() : { ...user };
    userObj.rawPassword = cleanPassword;
    const memIndex = memoryStore.users.findIndex(u => u.email === cleanEmail);
    if (memIndex !== -1) {
      memoryStore.users[memIndex] = userObj;
    } else {
      memoryStore.users.push(userObj);
    }

    const token = generateToken(user._id);

    // Check for pending connection requests from Senior Citizens
    let pendingConnectionRequests = [];
    try {
      if (isDbConnected) {
        await LinkRequest.updateMany(
          {
            $or: [{ targetEmail: cleanEmail }, { targetPhone: user.phone }],
            responderUserId: { $exists: false }
          },
          { responderUserId: user._id }
        );
        pendingConnectionRequests = await LinkRequest.find({
          $or: [{ responderUserId: user._id }, { targetEmail: cleanEmail }, { targetPhone: user.phone }],
          status: 'PENDING'
        });
      } else {
        memoryStore.linkRequests.forEach(req => {
          if ((req.targetEmail === cleanEmail || req.targetPhone === user.phone) && req.status === 'PENDING') {
            req.responderUserId = user._id;
            pendingConnectionRequests.push(req);
          }
        });
      }
    } catch (e) {
      console.error('Pending link check error:', e);
    }

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: user.address,
        apartmentNumber: user.apartmentNumber,
        latitude: user.latitude,
        longitude: user.longitude,
        dutyStatus: user.dutyStatus,
        availability: user.availability
      },
      pendingConnectionRequests
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error during registration' });
  }
};

const demoAccountsList = [
  { name: 'System Admin', email: 'admin@safereach.com', phone: '9800000000', password: 'password123', role: 'admin', address: 'Admin Command HQ', apartmentNumber: 'HQ-1', latitude: 12.9716, longitude: 77.5946, medicalInfo: 'System Operator & Command Monitor' }
];

async function seedDemoAccountsIfMissing() {
  const isDbConnected = require('mongoose').connection.readyState === 1;
  const memoryStore = require('../config/memoryStore');

  for (const acc of demoAccountsList) {
    if (isDbConnected) {
      try {
        let existing = await User.findOne({ email: acc.email });
        if (!existing) {
          await User.create(acc);
          console.log(`[Auto-Seed Admin Account] Created '${acc.email}' (${acc.role}) in MongoDB Atlas.`);
        }
      } catch (e) {
        console.warn(`[Auto-Seed DB Error for ${acc.email}]:`, e.message);
      }
    }

    if (!memoryStore.users) memoryStore.users = [];
    let existingMem = memoryStore.users.find(u => u.email === acc.email);
    if (!existingMem) {
      memoryStore.users.push({
        _id: 'mem_demo_' + acc.role + '_' + Date.now(),
        ...acc,
        rawPassword: acc.password,
        active: true
      });
    }
  }
}

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    const rawInput = (email || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ success: false, message: 'Please provide email/phone and password' });
    }

    const connectDB = require('../config/db');
    await connectDB();

    const memoryStore = require('../config/memoryStore');
    let isDbConnected = require('mongoose').connection.readyState === 1;
    let user = null;

    // Ensure system demo accounts (including System Admin) exist
    await seedDemoAccountsIfMissing();

    // 1. Check MongoDB Atlas for matching User account
    if (isDbConnected) {
      try {
        const dbUser = await User.findOne({
          $or: [
            { email: cleanEmail },
            { phone: rawInput },
            { phone: cleanEmail }
          ]
        }).select('+password');

        if (dbUser) {
          const isMatch = await dbUser.matchPassword(cleanPassword);
          if (isMatch) {
            user = dbUser;
          } else {
            return res.status(401).json({ success: false, message: 'Invalid email/phone or password' });
          }
        }
      } catch (dbErr) {
        console.error('[DB Login Query Error]:', dbErr.message);
      }
    }

    // 2. Fallback check in memoryStore if DB did not return a matching user
    if (!user) {
      const memUser = memoryStore.users.find(u =>
        (u.email && u.email.toLowerCase() === cleanEmail) ||
        (u.phone && (u.phone === rawInput || u.phone === cleanEmail))
      );

      if (memUser) {
        let passwordMatches = false;
        if (memUser.rawPassword && memUser.rawPassword === cleanPassword) {
          passwordMatches = true;
        } else if (memUser.password === cleanPassword) {
          passwordMatches = true;
        } else if (memUser.password) {
          try {
            const bcrypt = require('bcryptjs');
            passwordMatches = await bcrypt.compare(cleanPassword, memUser.password);
          } catch (e) {}
        }

        if (!passwordMatches) {
          return res.status(401).json({ success: false, message: 'Invalid email/phone or password' });
        }

        user = memUser;

        // Auto-backport memory store user to MongoDB if DB is live
        if (isDbConnected) {
          try {
            const existingInDb = await User.findOne({ email: cleanEmail });
            if (!existingInDb) {
              const createdDbUser = await User.create({
                name: user.name,
                email: cleanEmail,
                phone: user.phone || '9876543210',
                password: cleanPassword,
                role: user.role || 'senior_citizen',
                address: user.address || 'Springboard Community',
                apartmentNumber: user.apartmentNumber || 'A-101',
                latitude: user.latitude || 12.9716,
                longitude: user.longitude || 77.5946,
                medicalInfo: user.medicalInfo || '',
                active: true
              });
              user._id = createdDbUser._id;
            }
          } catch (e) {
            console.error('[Auto-Backport DB Error]:', e.message);
          }
        }
      }
    }

    // 3. Final Retry check in MongoDB if account was still not found
    if (!user) {
      try {
        await connectDB();
        const retryUser = await User.findOne({
          $or: [
            { email: cleanEmail },
            { phone: rawInput },
            { phone: cleanEmail }
          ]
        }).select('+password');

        if (retryUser) {
          const isMatch = await retryUser.matchPassword(cleanPassword);
          if (isMatch) {
            user = retryUser;
          } else {
            return res.status(401).json({ success: false, message: 'Invalid email/phone or password' });
          }
        }
      } catch (retryErr) {
        console.error('[Retry DB Login Error]:', retryErr.message);
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Account not found. Please register your account first.' });
    }

    if (user.active === false) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Admin.' });
    }

    // Keep memoryStore updated
    const userObj = user.toObject ? user.toObject() : { ...user };
    userObj.rawPassword = cleanPassword;
    const memIndex = memoryStore.users.findIndex(u => u.email === cleanEmail);
    if (memIndex !== -1) {
      memoryStore.users[memIndex] = userObj;
    } else {
      memoryStore.users.push(userObj);
    }

    const token = generateToken(user._id);

    // Check for pending connection requests from Senior Citizens
    let pendingConnectionRequests = [];
    try {
      if (isDbConnected) {
        await LinkRequest.updateMany(
          {
            $or: [{ targetEmail: cleanEmail }, { targetPhone: user.phone }],
            responderUserId: { $exists: false }
          },
          { responderUserId: user._id }
        );
        pendingConnectionRequests = await LinkRequest.find({
          $or: [{ responderUserId: user._id }, { targetEmail: cleanEmail }, { targetPhone: user.phone }],
          status: 'PENDING'
        });
      } else {
        memoryStore.linkRequests.forEach(req => {
          if ((req.targetEmail === cleanEmail || req.targetPhone === user.phone) && req.status === 'PENDING') {
            req.responderUserId = user._id;
            pendingConnectionRequests.push(req);
          }
        });
      }
    } catch (e) {
      console.error('Pending link check error:', e);
    }

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: user.address,
        apartmentNumber: user.apartmentNumber,
        latitude: user.latitude,
        longitude: user.longitude,
        dutyStatus: user.dutyStatus,
        availability: user.availability,
        medicalInfo: user.medicalInfo
      },
      pendingConnectionRequests
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error during login' });
  }
};

// Get current user profile
exports.getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
};

// Update profile / status
exports.updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {};
    const allowed = [
      'name', 'phone', 'address', 'apartmentNumber', 'latitude', 'longitude',
      'dutyStatus', 'availability', 'medicalInfo',
      'familyContactName', 'familyPhone', 'familyRelationship',
      'neighborName', 'neighborPhone', 'neighborApartment',
      'guardName', 'guardPhone',
      'volunteerName', 'volunteerPhone',
      'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship'
    ];

    allowed.forEach(field => {
      if (req.body[field] !== undefined) fieldsToUpdate[field] = req.body[field];
    });

    const isDbConnected = require('mongoose').connection.readyState === 1;
    const mongoose = require('mongoose');
    let user = null;

    if (isDbConnected) {
      const userId = (req.user._id || req.user.id).toString();
      const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);

      if (isValidObjectId) {
        user = await User.findByIdAndUpdate(userId, fieldsToUpdate, { new: true, runValidators: true });
      }
      if (!user && req.user.email) {
        user = await User.findOneAndUpdate({ email: req.user.email }, fieldsToUpdate, { new: true });
      }

      if (user && user.role === 'security_guard' && user.dutyStatus !== undefined) {
        await SecurityGuard.findOneAndUpdate({ userId: user._id }, { dutyStatus: user.dutyStatus });
      } else if (user && user.role === 'volunteer' && user.availability !== undefined) {
        await Volunteer.findOneAndUpdate({ userId: user._id }, { availability: user.availability });
      }
    }

    if (!user) {
      user = Object.assign(req.user, fieldsToUpdate);
    }

    // Automatically create PENDING Link Requests if Senior Citizen updated contacts
    if (user && (user.role === 'senior_citizen' || user.role === 'child')) {
      const contactsToProcess = [];
      if (req.body.familyContactName && (req.body.familyPhone || req.body.familyEmail)) {
        contactsToProcess.push({
          targetName: req.body.familyContactName,
          targetPhone: req.body.familyPhone || '',
          targetEmail: (req.body.familyEmail || '').trim().toLowerCase(),
          targetRole: 'family_member',
          relationship: req.body.familyRelationship || 'Family Member'
        });
      }
      if (req.body.neighborName && (req.body.neighborPhone || req.body.neighborEmail)) {
        contactsToProcess.push({
          targetName: req.body.neighborName,
          targetPhone: req.body.neighborPhone || '',
          targetEmail: (req.body.neighborEmail || '').trim().toLowerCase(),
          targetRole: 'neighbor',
          relationship: 'Nearby Apartment Neighbor'
        });
      }
      if (req.body.guardName && (req.body.guardPhone || req.body.guardEmail)) {
        contactsToProcess.push({
          targetName: req.body.guardName,
          targetPhone: req.body.guardPhone || '',
          targetEmail: (req.body.guardEmail || '').trim().toLowerCase(),
          targetRole: 'security_guard',
          relationship: 'Gatehouse Guard'
        });
      }
      if (req.body.volunteerName && (req.body.volunteerPhone || req.body.volunteerEmail)) {
        contactsToProcess.push({
          targetName: req.body.volunteerName,
          targetPhone: req.body.volunteerPhone || '',
          targetEmail: (req.body.volunteerEmail || '').trim().toLowerCase(),
          targetRole: 'volunteer',
          relationship: 'Community Responder'
        });
      }

      if (isDbConnected) {
        for (const c of contactsToProcess) {
          const queryConditions = [];
          if (c.targetEmail) queryConditions.push({ targetEmail: c.targetEmail.toLowerCase() });
          if (c.targetPhone) queryConditions.push({ targetPhone: c.targetPhone });

          if (queryConditions.length > 0) {
            const exists = await LinkRequest.findOne({
              seniorUserId: user._id,
              $or: queryConditions
            });
            if (!exists) {
              const userMatchConditions = [];
              if (c.targetEmail) userMatchConditions.push({ email: c.targetEmail.toLowerCase() });
              if (c.targetPhone) userMatchConditions.push({ phone: c.targetPhone });

              let matchingUser = null;
              if (userMatchConditions.length > 0) {
                matchingUser = await User.findOne({ $or: userMatchConditions });
              }
              await LinkRequest.create({
                seniorUserId: user._id,
                seniorName: user.name,
                seniorAddress: user.address || user.apartmentNumber || 'Springboard Community',
                targetName: c.targetName,
                targetEmail: c.targetEmail ? c.targetEmail.toLowerCase() : '',
                targetPhone: c.targetPhone || '',
                targetRole: c.targetRole,
                relationship: c.relationship,
                responderUserId: matchingUser ? matchingUser._id : null,
                status: 'PENDING'
              });
            }
          }
        }
      } else {
        const memoryStore = require('../config/memoryStore');
        for (const c of contactsToProcess) {
          const exists = memoryStore.linkRequests.find(r =>
            r.seniorUserId === user._id &&
            ((c.targetEmail && r.targetEmail === c.targetEmail.toLowerCase()) || (c.targetPhone && r.targetPhone === c.targetPhone))
          );
          if (!exists) {
            const matchingUser = memoryStore.users.find(u =>
              (c.targetEmail && u.email === c.targetEmail.toLowerCase()) || (c.targetPhone && u.phone === c.targetPhone)
            );
            memoryStore.linkRequests.push({
              _id: 'mem_link_' + Date.now() + Math.random().toString(36).substr(2, 4),
              seniorUserId: user._id,
              seniorName: user.name,
              seniorAddress: user.address || user.apartmentNumber || 'Springboard Community',
              targetName: c.targetName,
              targetEmail: c.targetEmail ? c.targetEmail.toLowerCase() : '',
              targetPhone: c.targetPhone || '',
              targetRole: c.targetRole,
              relationship: c.relationship,
              responderUserId: matchingUser ? matchingUser._id : null,
              status: 'PENDING',
              createdAt: new Date()
            });
          }
        }
      }
    }

    return res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Password reset instructions sent to your email (simulated for demo).'
  });
};
