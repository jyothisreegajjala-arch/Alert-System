const LinkRequest = require('../models/LinkRequest');
const User = require('../models/User');
const memoryStore = require('../config/memoryStore');
const mongoose = require('mongoose');

const isDbConnected = () => mongoose.connection.readyState === 1;

// Create new Link Request (Senior Citizen adding a contact)
exports.createLinkRequest = async (req, res) => {
  try {
    const { targetName, targetEmail, targetPhone, targetRole, relationship } = req.body;
    const seniorUser = req.user;

    if (!targetName || !targetEmail || !targetPhone || !targetRole) {
      return res.status(400).json({ success: false, message: 'Please provide contact name, email, phone, and role.' });
    }

    let existingResponderId = null;

    if (isDbConnected()) {
      // Search if a responder user with matching email or phone already exists
      const matchingUser = await User.findOne({
        $or: [
          { email: targetEmail.toLowerCase() },
          { phone: targetPhone }
        ]
      });

      if (matchingUser) {
        existingResponderId = matchingUser._id;
      }

      // Check if duplicate request exists
      const existingReq = await LinkRequest.findOne({
        seniorUserId: seniorUser._id,
        $or: [{ targetEmail: targetEmail.toLowerCase() }, { targetPhone }]
      });

      if (existingReq) {
        return res.status(400).json({ success: false, message: 'A link request has already been sent to this contact.' });
      }

      const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const linkReq = await LinkRequest.create({
        seniorUserId: seniorUser._id,
        seniorName: seniorUser.name,
        seniorAddress: seniorUser.address || seniorUser.apartmentNumber || 'Springboard Community',
        targetName,
        targetEmail: targetEmail.toLowerCase(),
        targetPhone,
        targetRole,
        relationship: relationship || 'Community Contact',
        responderUserId: existingResponderId,
        requestDate: currentDate,
        status: 'PENDING'
      });

      const Notification = require('../models/Notification');
      const notif = await Notification.create({
        recipientUserId: existingResponderId,
        recipientRole: targetRole,
        targetEmail: targetEmail.toLowerCase(),
        senderUserId: seniorUser._id,
        senderName: seniorUser.name,
        senderRole: seniorUser.role === 'child' ? 'Child' : 'Senior Citizen',
        emergencyType: 'Account Connection Request',
        address: seniorUser.address || 'Springboard Community',
        apartment: seniorUser.apartmentNumber || '',
        message: `${seniorUser.name} (${seniorUser.role === 'child' ? 'Child' : 'Senior Citizen'}) wants to connect with you as a ${targetRole.replace('_', ' ')}.`,
        type: 'LINK_REQUEST',
        status: 'PENDING',
        linkRequestId: linkReq._id,
        date: currentDate,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });

      if (req.app.get('emitNotification')) {
        req.app.get('emitNotification')({
          recipientUserId: existingResponderId,
          recipientRole: targetRole,
          notification: notif
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Account Link Request created successfully with status PENDING.',
        linkRequest: linkReq,
        notification: notif
      });
    } else {
      // Memory Store Fallback
      const matchingUser = memoryStore.users.find(u =>
        u.email.toLowerCase() === targetEmail.toLowerCase() || u.phone === targetPhone
      );

      if (matchingUser) existingResponderId = matchingUser._id;

      const existingReq = memoryStore.linkRequests.find(r =>
        r.seniorUserId.toString() === seniorUser._id.toString() &&
        (r.targetEmail.toLowerCase() === targetEmail.toLowerCase() || r.targetPhone === targetPhone)
      );

      if (existingReq) {
        return res.status(400).json({ success: false, message: 'A link request has already been sent to this contact.' });
      }

      const newReq = {
        _id: 'req_' + Date.now(),
        seniorUserId: seniorUser._id,
        seniorName: seniorUser.name,
        seniorAddress: seniorUser.address || seniorUser.apartmentNumber || 'Springboard Community',
        targetName,
        targetEmail: targetEmail.toLowerCase(),
        targetPhone,
        targetRole,
        relationship: relationship || 'Community Contact',
        responderUserId: existingResponderId,
        status: 'PENDING',
        requestDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        createdAt: new Date()
      };

      memoryStore.linkRequests.push(newReq);

      if (!memoryStore.notifications) memoryStore.notifications = [];
      const newNotif = {
        _id: 'notif_' + Date.now(),
        recipientUserId: existingResponderId,
        recipientRole: targetRole,
        senderUserId: seniorUser._id,
        senderName: seniorUser.name,
        senderRole: seniorUser.role === 'child' ? 'Child' : 'Senior Citizen',
        emergencyType: 'Account Connection Request',
        address: seniorUser.address || 'Springboard Community',
        apartment: seniorUser.apartmentNumber || '',
        message: `${seniorUser.name} (${seniorUser.role === 'child' ? 'Child' : 'Senior Citizen'}) wants to connect with you as a ${targetRole.replace('_', ' ')}.`,
        type: 'LINK_REQUEST',
        status: 'PENDING',
        linkRequestId: newReq._id,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date()
      };
      memoryStore.notifications.unshift(newNotif);

      if (req.app.get('emitNotification')) {
        req.app.get('emitNotification')({
          recipientUserId: existingResponderId,
          recipientRole: targetRole,
          notification: newNotif
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Account Link Request created successfully with status PENDING.',
        linkRequest: newReq,
        notification: newNotif
      });
    }
  } catch (err) {
    console.error('Create Link Request Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get Pending Link Requests for Responder User
exports.getResponderLinkRequests = async (req, res) => {
  try {
    const user = req.user;

    if (isDbConnected()) {
      const requests = await LinkRequest.find({
        $or: [
          { responderUserId: user._id },
          { targetEmail: user.email.toLowerCase() },
          { targetPhone: user.phone }
        ]
      }).sort({ createdAt: -1 });

      return res.status(200).json({ success: true, requests });
    } else {
      const requests = memoryStore.linkRequests.filter(r =>
        (r.responderUserId && r.responderUserId.toString() === user._id.toString()) ||
        r.targetEmail.toLowerCase() === user.email.toLowerCase() ||
        r.targetPhone === user.phone
      );

      return res.status(200).json({ success: true, requests });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get All Link Requests for Senior Citizen (Pending, Accepted, Rejected)
exports.getSeniorLinkRequests = async (req, res) => {
  try {
    const seniorUser = req.user;

    if (isDbConnected()) {
      const requests = await LinkRequest.find({ seniorUserId: seniorUser._id }).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, requests });
    } else {
      const requests = memoryStore.linkRequests.filter(r =>
        r.seniorUserId.toString() === seniorUser._id.toString()
      );
      return res.status(200).json({ success: true, requests });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Accept Link Request
exports.acceptLinkRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const user = req.user;

    if (isDbConnected()) {
      const linkReq = await LinkRequest.findById(requestId);
      if (!linkReq) return res.status(404).json({ success: false, message: 'Link request not found' });

      linkReq.status = 'ACCEPTED';
      linkReq.responderUserId = user._id;
      linkReq.updatedAt = Date.now();
      await linkReq.save();

      return res.status(200).json({
        success: true,
        message: 'Account linked successfully! You will now receive emergency alerts for this Senior Citizen.',
        linkRequest: linkReq
      });
    } else {
      const linkReq = memoryStore.linkRequests.find(r => r._id.toString() === requestId.toString());
      if (!linkReq) return res.status(404).json({ success: false, message: 'Link request not found' });

      linkReq.status = 'ACCEPTED';
      linkReq.responderUserId = user._id;
      linkReq.updatedAt = new Date();

      return res.status(200).json({
        success: true,
        message: 'Account linked successfully! You will now receive emergency alerts for this Senior Citizen.',
        linkRequest: linkReq
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Reject Link Request
exports.rejectLinkRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const user = req.user;

    if (isDbConnected()) {
      const linkReq = await LinkRequest.findById(requestId);
      if (!linkReq) return res.status(404).json({ success: false, message: 'Link request not found' });

      linkReq.status = 'REJECTED';
      linkReq.responderUserId = user._id;
      linkReq.updatedAt = Date.now();
      await linkReq.save();

      return res.status(200).json({
        success: true,
        message: 'Link request declined.',
        linkRequest: linkReq
      });
    } else {
      const linkReq = memoryStore.linkRequests.find(r => r._id.toString() === requestId.toString());
      if (!linkReq) return res.status(404).json({ success: false, message: 'Link request not found' });

      linkReq.status = 'REJECTED';
      linkReq.responderUserId = user._id;
      linkReq.updatedAt = new Date();

      return res.status(200).json({
        success: true,
        message: 'Link request declined.',
        linkRequest: linkReq
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Unlink Account (Remove connection)
exports.unlinkAccount = async (req, res) => {
  try {
    const { requestId } = req.params;

    if (isDbConnected()) {
      await LinkRequest.findByIdAndDelete(requestId);
      return res.status(200).json({ success: true, message: 'Account unlinked successfully.' });
    } else {
      const idx = memoryStore.linkRequests.findIndex(r => r._id.toString() === requestId.toString());
      if (idx !== -1) memoryStore.linkRequests.splice(idx, 1);
      return res.status(200).json({ success: true, message: 'Account unlinked successfully.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
