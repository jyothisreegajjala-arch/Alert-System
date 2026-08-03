const Emergency = require('../models/Emergency');
const User = require('../models/User');

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

    const emergency = await Emergency.create({
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

    // Update user's last known location
    await User.findByIdAndUpdate(user._id, { latitude: latNum, longitude: lngNum });

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

    const emergency = await Emergency.findOne({ $or: [{ _id: emergencyId }, { alertId: emergencyId }] });

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

    const emergency = await Emergency.findOne({ $or: [{ _id: emergencyId }, { alertId: emergencyId }] });

    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency not found' });
    }

    emergency.status = 'RESOLVED';
    emergency.resolvedAt = new Date();
    if (resolutionNotes) emergency.resolutionNotes = resolutionNotes;

    await emergency.save();

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
    const emergency = await Emergency.findById(emergencyId);

    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency not found' });
    }

    emergency.status = 'CANCELLED';
    await emergency.save();

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
    const LinkRequest = require('../models/LinkRequest');

    let filter = { status: { $in: ['PENDING_LOCAL', 'PENDING_FAMILY', 'ESCALATED_NEIGHBOR_GUARD', 'ESCALATED_VOLUNTEER', 'ACCEPTED'] } };
    if (req.user.role === 'senior_citizen' || req.user.role === 'child') {
      filter.userId = req.user._id;
    } else if (req.user.role !== 'admin') {
      const acceptedLinks = await LinkRequest.find({
        $or: [
          { responderUserId: req.user._id },
          { targetEmail: req.user.email ? req.user.email.toLowerCase() : '' },
          { targetPhone: req.user.phone }
        ],
        status: 'ACCEPTED'
      });
      const seniorIds = acceptedLinks.map(l => l.seniorUserId);
      if (seniorIds.length > 0) {
        filter = {
          $and: [
            { status: { $in: ['PENDING_LOCAL', 'PENDING_FAMILY', 'ESCALATED_NEIGHBOR_GUARD', 'ESCALATED_VOLUNTEER', 'ACCEPTED'] } },
            { $or: [{ userId: { $in: seniorIds } }, { userId: { $exists: true } }] }
          ]
        };
      }
    }
    const emergencies = await Emergency.find(filter).sort({ createdAt: -1 });

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
    let filter = {};
    if (req.user.role === 'senior_citizen' || req.user.role === 'child') {
      filter.userId = req.user._id;
    }
    const emergencies = await Emergency.find(filter).sort({ createdAt: -1 }).limit(100);

    res.status(200).json({
      success: true,
      count: emergencies.length,
      emergencies
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch emergency history' });
  }
};
