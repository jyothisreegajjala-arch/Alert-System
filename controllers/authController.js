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
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, address, apartmentNumber, latitude, longitude, medicalInfo } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const memoryStore = require('../config/memoryStore');
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let user = null;

    const existingMemUser = memoryStore.users.find(u => u.email === cleanEmail);

    if (isDbConnected) {
      try {
        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser || existingMemUser) {
          return res.status(400).json({ success: false, message: 'Email address is already registered' });
        }

        user = await User.create({
          name: name || cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: phone || '9876543210',
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
      } catch (dbErr) {
        console.error('[DB Register Fallback]:', dbErr.message);
        user = null;
      }
    }

    if (!user) {
      if (existingMemUser) {
        return res.status(400).json({ success: false, message: 'Email address is already registered' });
      }
      user = {
        _id: 'mem_user_' + Date.now(),
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: phone || '9876543210',
        password: cleanPassword,
        role: role || 'senior_citizen',
        address: address || 'Springboard Community',
        apartmentNumber: apartmentNumber || 'A-101',
        latitude: latitude || 12.9716,
        longitude: longitude || 77.5946,
        medicalInfo: medicalInfo || '',
        active: true,
        dutyStatus: role === 'security_guard' ? 'ON_DUTY' : undefined,
        availability: role === 'volunteer' ? 'AVAILABLE' : undefined
      };
    }

    // Keep memoryStore in sync with MongoDB created user
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

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const rawInput = (email || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ success: false, message: 'Please provide email/phone and password' });
    }

    const memoryStore = require('../config/memoryStore');
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let user = null;

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
        console.error('[DB Login Fallback]:', dbErr.message);
        user = null;
      }
    }

    // Fallback to memoryStore if DB did not return a matching user
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
      } else {
        return res.status(401).json({ success: false, message: 'Account not found. Please register your account first.' });
      }
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
    let user;

    if (isDbConnected) {
      const userId = (req.user._id || req.user.id).toString();
      user = await User.findByIdAndUpdate(userId, fieldsToUpdate, { new: true, runValidators: true });
      if (user && user.role === 'security_guard' && user.dutyStatus !== undefined) {
        await SecurityGuard.findOneAndUpdate({ userId: user._id }, { dutyStatus: user.dutyStatus });
      } else if (user && user.role === 'volunteer' && user.availability !== undefined) {
        await Volunteer.findOneAndUpdate({ userId: user._id }, { availability: user.availability });
      }
    } else {
      user = Object.assign(req.user, fieldsToUpdate);
    }

    // Automatically create PENDING Link Requests if Senior Citizen updated contacts
    if (user && user.role === 'senior_citizen') {
      const contactsToProcess = [];
      if (req.body.familyContactName && (req.body.familyPhone || req.body.familyEmail)) {
        contactsToProcess.push({
          targetName: req.body.familyContactName,
          targetPhone: req.body.familyPhone || '',
          targetEmail: (req.body.familyEmail || '').trim().toLowerCase(),
          targetRole: 'family_member',
          relationship: req.body.familyRelationship || 'Son'
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
          const exists = await LinkRequest.findOne({
            seniorUserId: user._id,
            $or: [{ targetEmail: c.targetEmail.toLowerCase() }, { targetPhone: c.targetPhone }]
          });
          if (!exists) {
            const matchingUser = await User.findOne({
              $or: [{ email: c.targetEmail.toLowerCase() }, { phone: c.targetPhone }]
            });
            await LinkRequest.create({
              seniorUserId: user._id,
              seniorName: user.name,
              seniorAddress: user.address || user.apartmentNumber || 'Springboard Community',
              targetName: c.targetName,
              targetEmail: c.targetEmail.toLowerCase(),
              targetPhone: c.targetPhone,
              targetRole: c.targetRole,
              relationship: c.relationship,
              responderUserId: matchingUser ? matchingUser._id : null,
              status: 'PENDING'
            });
          }
        }
      } else {
        const memoryStore = require('../config/memoryStore');
        for (const c of contactsToProcess) {
          const exists = memoryStore.linkRequests.find(r =>
            r.seniorUserId === user._id &&
            (r.targetEmail === c.targetEmail.toLowerCase() || r.targetPhone === c.targetPhone)
          );
          if (!exists) {
            const matchingUser = memoryStore.users.find(u => u.email === c.targetEmail.toLowerCase() || u.phone === c.targetPhone);
            memoryStore.linkRequests.push({
              _id: 'mem_link_' + Date.now(),
              seniorUserId: user._id,
              seniorName: user.name,
              seniorAddress: user.address || user.apartmentNumber || 'Springboard Community',
              targetName: c.targetName,
              targetEmail: c.targetEmail.toLowerCase(),
              targetPhone: c.targetPhone,
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
