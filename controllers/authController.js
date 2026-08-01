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

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email address is already registered' });
    }

    const user = await User.create({
      name,
      email: cleanEmail,
      phone,
      password: cleanPassword,
      role,
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

    const token = generateToken(user._id);

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
      }
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
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(cleanPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.active === false) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Admin.' });
    }

    const token = generateToken(user._id);

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
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
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

    const userId = (req.user._id || req.user.id).toString();
    const user = await User.findByIdAndUpdate(userId, fieldsToUpdate, { new: true, runValidators: true });
    if (user.role === 'security_guard' && user.dutyStatus !== undefined) {
      await SecurityGuard.findOneAndUpdate({ userId: user._id }, { dutyStatus: user.dutyStatus });
    } else if (user.role === 'volunteer' && user.availability !== undefined) {
      await Volunteer.findOneAndUpdate({ userId: user._id }, { availability: user.availability });
    }

    // Automatically create PENDING Link Requests if Senior Citizen updated contacts
    if (user.role === 'senior_citizen') {
      const contactsToProcess = [];
      if (req.body.familyContactName && (req.body.familyPhone || req.body.familyEmail)) {
        contactsToProcess.push({
          targetName: req.body.familyContactName,
          targetPhone: req.body.familyPhone || '',
          targetEmail: req.body.familyEmail || 'family@safereach.com',
          targetRole: 'family_member',
          relationship: req.body.familyRelationship || 'Son'
        });
      }
      if (req.body.neighborName && (req.body.neighborPhone || req.body.neighborEmail)) {
        contactsToProcess.push({
          targetName: req.body.neighborName,
          targetPhone: req.body.neighborPhone || '',
          targetEmail: req.body.neighborEmail || 'neighbor@safereach.com',
          targetRole: 'neighbor',
          relationship: 'Nearby Apartment Neighbor'
        });
      }
      if (req.body.guardName && (req.body.guardPhone || req.body.guardEmail)) {
        contactsToProcess.push({
          targetName: req.body.guardName,
          targetPhone: req.body.guardPhone || '',
          targetEmail: req.body.guardEmail || 'guard@safereach.com',
          targetRole: 'security_guard',
          relationship: 'Gatehouse Guard'
        });
      }
      if (req.body.volunteerName && (req.body.volunteerPhone || req.body.volunteerEmail)) {
        contactsToProcess.push({
          targetName: req.body.volunteerName,
          targetPhone: req.body.volunteerPhone || '',
          targetEmail: req.body.volunteerEmail || 'volunteer@safereach.com',
          targetRole: 'volunteer',
          relationship: 'Community Responder'
        });
      }

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
