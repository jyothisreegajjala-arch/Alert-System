const Emergency = require('../models/Emergency');
const User = require('../models/User');

const getFormattedDateTime = () => {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  return { date, time };
};

const formatEmergencyIST = (e) => {
  if (!e) return e;
  const obj = e.toObject ? e.toObject() : { ...e };
  const d = obj.createdAt ? new Date(obj.createdAt) : new Date();
  if (!isNaN(d.getTime())) {
    obj.time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    obj.date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
  }
  return obj;
};

// Trigger SOS
exports.triggerSOS = async (req, res) => {
  try {
    const user = req.user;
    const { latitude, longitude, address, emergencyType, medicalInfo } = req.body;
    const now = new Date();
    const { date, time } = getFormattedDateTime(now);
    const alertId = `SR-${Math.floor(100000 + Math.random() * 900000)}`;

    const latNum = Number(latitude) || user.latitude || 12.9716;
    const lngNum = Number(longitude) || user.longitude || 77.5946;
    const googleMapsUrl = `https://www.google.com/maps?q=${latNum},${lngNum}`;
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let emergency;

    if (isDbConnected) {
      emergency = await Emergency.create({
        alertId,
        userId: user._id,
        userName: user.name,
        userPhone: user.phone,
        userRole: user.role,
        address: address || user.address || 'Springboard Community',
        latitude: latNum,
        longitude: lngNum,
        date,
        time,
        createdAt: now,
        emergencyType: emergencyType || 'Medical & Safety Emergency (SOS)',
        medicalInfo: medicalInfo || user.medicalInfo || 'None',
        status: 'PENDING_LOCAL',
        tier1Notified: true,
        tier2Notified: false
      });

      await User.findByIdAndUpdate(user._id, { latitude: latNum, longitude: lngNum });
    } else {
      const memoryStore = require('../config/memoryStore');
      emergency = {
        _id: 'mem_emg_' + Date.now(),
        alertId,
        userId: user._id,
        userName: user.name,
        userPhone: user.phone,
        userRole: user.role,
        address: address || user.address || 'Springboard Community',
        latitude: latNum,
        longitude: lngNum,
        date,
        time,
        emergencyType: emergencyType || 'Medical & Safety Emergency (SOS)',
        medicalInfo: medicalInfo || user.medicalInfo || 'None',
        status: 'PENDING_LOCAL',
        tier1Notified: true,
        tier2Notified: false,
        createdAt: new Date()
      };
      memoryStore.emergencies.push(emergency);
      user.latitude = latNum;
      user.longitude = lngNum;
    }

    const emergencyObject = formatEmergencyIST(emergency);
    emergencyObject.googleMapsUrl = googleMapsUrl;

    if (req.app.get('handleSOSTrigger')) {
      req.app.get('handleSOSTrigger')(emergencyObject);
    }

    res.status(201).json({
      success: true,
      emergency: emergencyObject,
      message: 'SOS Emergency alert broadcasted to nearby Neighbors and Security Guards.'
    });
  } catch (err) {
    console.error('Trigger SOS Error:', err);
    res.status(500).json({ success: false, message: 'Failed to trigger SOS emergency' });
  }
};

// Accept Emergency
exports.acceptEmergency = async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const responder = req.user;
    const now = new Date();
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let emergency;

    if (isDbConnected) {
      emergency = await Emergency.findOne({ $or: [{ _id: emergencyId }, { alertId: emergencyId }] });

      if (!emergency) {
        return res.status(404).json({ success: false, message: 'Emergency alert not found' });
      }

      if (emergency.status === 'ACCEPTED') {
        return res.status(400).json({ success: false, message: 'This emergency has already been accepted by another responder.' });
      }

      const responseTimeSec = Math.round((now - new Date(emergency.createdAt)) / 1000);

      emergency.status = 'ACCEPTED';
      emergency.acceptedBy = {
        userId: responder._id,
        name: responder.name,
        phone: responder.phone,
        role: responder.role
      };
      emergency.acceptedAt = now;
      emergency.responseTimeSeconds = responseTimeSec;

      await emergency.save();
    } else {
      const memoryStore = require('../config/memoryStore');
      emergency = memoryStore.emergencies.find(e => e._id.toString() === emergencyId.toString() || e.alertId === emergencyId);
      if (!emergency) {
        return res.status(404).json({ success: false, message: 'Emergency alert not found' });
      }
      if (emergency.status === 'ACCEPTED') {
        return res.status(400).json({ success: false, message: 'This emergency has already been accepted by another responder.' });
      }
      emergency.status = 'ACCEPTED';
      emergency.acceptedBy = {
        userId: responder._id,
        name: responder.name,
        phone: responder.phone,
        role: responder.role
      };
      emergency.acceptedAt = now;
    }

    if (req.app.get('handleSOSAccept')) {
      req.app.get('handleSOSAccept')(emergency);
    }

    res.status(200).json({
      success: true,
      emergency,
      message: `Emergency successfully accepted by ${responder.name} (${responder.role}).`
    });
  } catch (err) {
    console.error('Accept Emergency Error:', err);
    res.status(500).json({ success: false, message: 'Failed to accept emergency' });
  }
};

exports.rejectEmergency = async (req, res) => {
  res.status(200).json({ success: true, message: 'Alert dismissed for your view.' });
};

// Resolve Emergency
exports.resolveEmergency = async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const { resolutionNotes } = req.body;
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let emergency;

    if (isDbConnected) {
      emergency = await Emergency.findOne({ $or: [{ _id: emergencyId }, { alertId: emergencyId }] });

      if (!emergency) {
        return res.status(404).json({ success: false, message: 'Emergency not found' });
      }

      emergency.status = 'RESOLVED';
      emergency.resolvedAt = new Date();
      if (resolutionNotes) emergency.resolutionNotes = resolutionNotes;

      await emergency.save();
    } else {
      const memoryStore = require('../config/memoryStore');
      emergency = memoryStore.emergencies.find(e => e._id.toString() === emergencyId.toString() || e.alertId === emergencyId);
      if (!emergency) {
        return res.status(404).json({ success: false, message: 'Emergency not found' });
      }
      emergency.status = 'RESOLVED';
      emergency.resolvedAt = new Date();
      if (resolutionNotes) emergency.resolutionNotes = resolutionNotes;
    }

    if (req.app.get('handleSOSResolve')) {
      req.app.get('handleSOSResolve')(emergency);
    }

    res.status(200).json({
      success: true,
      emergency,
      message: 'Emergency successfully marked as RESOLVED.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to resolve emergency' });
  }
};

// Cancel Emergency
exports.cancelEmergency = async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let emergency;

    if (isDbConnected) {
      emergency = await Emergency.findById(emergencyId);

      if (!emergency) {
        return res.status(404).json({ success: false, message: 'Emergency not found' });
      }

      emergency.status = 'CANCELLED';
      await emergency.save();
    } else {
      const memoryStore = require('../config/memoryStore');
      emergency = memoryStore.emergencies.find(e => e._id.toString() === emergencyId.toString() || e.alertId === emergencyId);
      if (!emergency) {
        return res.status(404).json({ success: false, message: 'Emergency not found' });
      }
      emergency.status = 'CANCELLED';
    }

    if (req.app.get('handleSOSCancel')) {
      req.app.get('handleSOSCancel')(emergency);
    }

    res.status(200).json({ success: true, message: 'Emergency alert cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to cancel emergency' });
  }
};

// Active Emergencies
exports.getActiveEmergencies = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    const userRole = req.user.role;
    const userId = req.user._id || req.user.id;

    let emergencies = [];

    if (isDbConnected) {
      const LinkRequest = require('../models/LinkRequest');
      let filter = { status: { $in: ['PENDING_LOCAL', 'PENDING_FAMILY', 'ESCALATED_NEIGHBOR_GUARD', 'ESCALATED_VOLUNTEER', 'ACCEPTED'] } };

      if (userRole === 'senior_citizen' || userRole === 'child') {
        filter.userId = userId;
      } else if (userRole !== 'admin') {
        const userLinks = await LinkRequest.find({
          $or: [
            { responderUserId: userId },
            { targetEmail: req.user.email ? req.user.email.toLowerCase() : '' },
            { targetPhone: req.user.phone }
          ]
        });

        const seniorIds = userLinks.map(l => l.seniorUserId);
        filter.$or = [
          { userId: { $in: seniorIds } },
          { _id: { $exists: true } }
        ];
      }

      emergencies = await Emergency.find(filter).sort({ createdAt: -1 });
    } else {
      const memoryStore = require('../config/memoryStore');
      const activeStatuses = ['PENDING_LOCAL', 'PENDING_FAMILY', 'ESCALATED_NEIGHBOR_GUARD', 'ESCALATED_VOLUNTEER', 'ACCEPTED'];
      let allActive = memoryStore.emergencies.filter(e => activeStatuses.includes(e.status));

      if (userRole === 'senior_citizen' || userRole === 'child') {
        emergencies = allActive.filter(e => e.userId.toString() === userId.toString());
      } else {
        emergencies = allActive;
      }
    }

    res.status(200).json({
      success: true,
      count: emergencies.length,
      emergencies: emergencies.map(formatEmergencyIST)
    });
  } catch (err) {
    console.error('getActiveEmergencies error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch active emergencies' });
  }
};

// Emergency History
exports.getEmergencyHistory = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    const userRole = req.user.role;
    const userId = req.user._id || req.user.id;

    let emergencies = [];

    if (isDbConnected) {
      const LinkRequest = require('../models/LinkRequest');
      let filter = {};

      if (userRole === 'senior_citizen' || userRole === 'child') {
        filter.userId = userId;
      } else if (userRole !== 'admin') {
        const acceptedLinks = await LinkRequest.find({
          $or: [
            { responderUserId: userId },
            { targetEmail: req.user.email ? req.user.email.toLowerCase() : '' },
            { targetPhone: req.user.phone }
          ],
          status: 'ACCEPTED'
        });

        const seniorIds = acceptedLinks.map(l => l.seniorUserId);
        if (seniorIds.length === 0) {
          return res.status(200).json({ success: true, count: 0, emergencies: [] });
        }
        filter.userId = { $in: seniorIds };
      }

      emergencies = await Emergency.find(filter).sort({ createdAt: -1 }).limit(100);
    } else {
      const memoryStore = require('../config/memoryStore');
      if (userRole === 'senior_citizen' || userRole === 'child') {
        emergencies = memoryStore.emergencies.filter(e => e.userId.toString() === userId.toString());
      } else if (userRole === 'admin') {
        emergencies = memoryStore.emergencies;
      } else {
        const acceptedLinks = memoryStore.linkRequests.filter(l =>
          l.status === 'ACCEPTED' &&
          (
            (l.responderUserId && l.responderUserId.toString() === userId.toString()) ||
            (l.targetEmail && l.targetEmail.toLowerCase() === (req.user.email || '').toLowerCase()) ||
            (l.targetPhone && l.targetPhone === req.user.phone)
          )
        );
        const seniorIdStrs = acceptedLinks.map(l => l.seniorUserId.toString());
        emergencies = memoryStore.emergencies.filter(e => seniorIdStrs.includes(e.userId.toString()));
      }
    }

    res.status(200).json({
      success: true,
      count: emergencies.length,
      emergencies: emergencies.map(formatEmergencyIST)
    });
  } catch (err) {
    console.error('getEmergencyHistory error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch emergency history' });
  }
};

