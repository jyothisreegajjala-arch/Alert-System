const Emergency = require('../models/Emergency');
const User = require('../models/User');
const memoryStore = require('../config/memoryStore');
const mongoose = require('mongoose');

const isDbConnected = () => mongoose.connection.readyState === 1;

const getFormattedDateTime = () => {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { date, time };
};

// Trigger SOS
exports.triggerSOS = async (req, res) => {
  try {
    const { latitude, longitude, address, emergencyType, medicalInfo } = req.body;
    const user = req.user;
    const { date, time } = getFormattedDateTime();
    const alertId = `SR-${Math.floor(100000 + Math.random() * 900000)}`;

    const latNum = Number(latitude) || user.latitude || 12.9716;
    const lngNum = Number(longitude) || user.longitude || 77.5946;
    const googleMapsUrl = `https://www.google.com/maps?q=${latNum},${lngNum}`;

    let emergency;

    if (isDbConnected()) {
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
        emergencyType: emergencyType || 'Medical & Safety Emergency (SOS)',
        medicalInfo: medicalInfo || user.medicalInfo || 'None',
        status: 'PENDING_LOCAL',
        tier1Notified: true,
        tier2Notified: false
      });

      // Update user's last known location in MongoDB Atlas
      await User.findByIdAndUpdate(user._id, { latitude: latNum, longitude: lngNum });
    } else {
      emergency = {
        _id: 'emg_' + Date.now(),
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
      memoryStore.emergencies.unshift(emergency);
    }

    // Attach computed googleMapsUrl for real-time socket payload
    const emergencyObject = emergency.toObject ? emergency.toObject() : { ...emergency };
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

    let emergency;

    if (isDbConnected()) {
      emergency = await Emergency.findOne({ $or: [{ _id: emergencyId }, { alertId: emergencyId }] });
    } else {
      emergency = memoryStore.emergencies.find(e => e._id.toString() === emergencyId || e.alertId === emergencyId);
    }

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

    if (isDbConnected()) {
      await emergency.save();
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

    let emergency;

    if (isDbConnected()) {
      emergency = await Emergency.findOne({ $or: [{ _id: emergencyId }, { alertId: emergencyId }] });
    } else {
      emergency = memoryStore.emergencies.find(e => e._id.toString() === emergencyId || e.alertId === emergencyId);
    }

    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency not found' });
    }

    emergency.status = 'RESOLVED';
    emergency.resolvedAt = new Date();
    if (resolutionNotes) emergency.resolutionNotes = resolutionNotes;

    if (isDbConnected()) {
      await emergency.save();
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
    let emergency;

    if (isDbConnected()) {
      emergency = await Emergency.findById(emergencyId);
    } else {
      emergency = memoryStore.emergencies.find(e => e._id.toString() === emergencyId);
    }

    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency not found' });
    }

    emergency.status = 'CANCELLED';
    if (isDbConnected()) await emergency.save();

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
    let emergencies;
    const LinkRequest = require('../models/LinkRequest');

    if (isDbConnected()) {
      let filter = { status: { $in: ['PENDING_LOCAL', 'ACCEPTED', 'ESCALATED_VOLUNTEER'] } };
      if (req.user.role === 'senior_citizen' || req.user.role === 'child') {
        filter.userId = req.user._id;
      } else if (req.user.role !== 'admin') {
        const acceptedLinks = await LinkRequest.find({
          $or: [
            { responderUserId: req.user._id },
            { targetEmail: req.user.email.toLowerCase() },
            { targetPhone: req.user.phone }
          ],
          status: 'ACCEPTED'
        });
        const seniorIds = acceptedLinks.map(l => l.seniorUserId);
        filter.userId = { $in: seniorIds };
      }
      emergencies = await Emergency.find(filter).sort({ createdAt: -1 });
    } else {
      emergencies = memoryStore.emergencies.filter(e => ['PENDING_LOCAL', 'ACCEPTED', 'ESCALATED_VOLUNTEER'].includes(e.status));
      if (req.user.role === 'senior_citizen' || req.user.role === 'child') {
        emergencies = emergencies.filter(e => e.userId.toString() === req.user._id.toString());
      } else if (req.user.role !== 'admin') {
        const acceptedLinks = memoryStore.linkRequests.filter(r =>
          r.status === 'ACCEPTED' && (
            (r.responderUserId && r.responderUserId.toString() === req.user._id.toString()) ||
            r.targetEmail.toLowerCase() === req.user.email.toLowerCase() ||
            r.targetPhone === req.user.phone
          )
        );
        const seniorIds = acceptedLinks.map(l => l.seniorUserId.toString());
        emergencies = emergencies.filter(e => seniorIds.includes(e.userId.toString()));
      }
    }

    res.status(200).json({
      success: true,
      count: emergencies.length,
      emergencies
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch active emergencies' });
  }
};

// Emergency History
exports.getEmergencyHistory = async (req, res) => {
  try {
    let emergencies;

    if (isDbConnected()) {
      let filter = {};
      if (req.user.role === 'senior_citizen' || req.user.role === 'child') {
        filter.userId = req.user._id;
      }
      emergencies = await Emergency.find(filter).sort({ createdAt: -1 }).limit(100);
    } else {
      emergencies = memoryStore.emergencies;
      if (req.user.role === 'senior_citizen' || req.user.role === 'child') {
        emergencies = emergencies.filter(e => e.userId.toString() === req.user._id.toString());
      }
    }

    res.status(200).json({
      success: true,
      count: emergencies.length,
      emergencies
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch emergency history' });
  }
};
