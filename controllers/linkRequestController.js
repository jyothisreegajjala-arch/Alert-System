const LinkRequest = require('../models/LinkRequest');
const User = require('../models/User');

// Create new Link Request (Senior Citizen adding a contact)
exports.createLinkRequest = async (req, res) => {
  try {
    const { targetName, targetEmail, targetPhone, targetRole, relationship } = req.body;
    const seniorUser = req.user;

    if (!targetName || !targetEmail || !targetPhone || !targetRole) {
      return res.status(400).json({ success: false, message: 'Please provide contact name, email, phone, and role.' });
    }

    const cleanEmail = targetEmail.trim().toLowerCase();
    const cleanPhone = targetPhone.trim();
    const isDbConnected = require('mongoose').connection.readyState === 1;

    let existingResponderId = null;
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (isDbConnected) {
      const matchingUser = await User.findOne({
        $or: [{ email: cleanEmail }, { phone: cleanPhone }]
      });
      if (matchingUser) existingResponderId = matchingUser._id;

      const existingReq = await LinkRequest.findOne({
        seniorUserId: seniorUser._id,
        $or: [{ targetEmail: cleanEmail }, { targetPhone: cleanPhone }]
      });
      if (existingReq) {
        return res.status(400).json({ success: false, message: 'A link request has already been sent to this contact.' });
      }

      const linkReq = await LinkRequest.create({
        seniorUserId: seniorUser._id,
        seniorName: seniorUser.name,
        seniorAddress: seniorUser.address || seniorUser.apartmentNumber || 'Springboard Community',
        targetName,
        targetEmail: cleanEmail,
        targetPhone: cleanPhone,
        targetRole,
        relationship: relationship || 'Community Contact',
        responderUserId: existingResponderId,
        requestDate: currentDate,
        status: 'PENDING'
      });

      return res.status(201).json({
        success: true,
        message: 'Account Link Request created successfully with status PENDING.',
        linkRequest: linkReq
      });
    } else {
      const memoryStore = require('../config/memoryStore');
      const matchingUser = memoryStore.users.find(u =>
        (u.email && u.email.toLowerCase() === cleanEmail) ||
        (u.phone && u.phone === cleanPhone)
      );
      if (matchingUser) existingResponderId = matchingUser._id;

      const existingReq = memoryStore.linkRequests.find(r =>
        r.seniorUserId.toString() === seniorUser._id.toString() &&
        ((r.targetEmail && r.targetEmail.toLowerCase() === cleanEmail) || (r.targetPhone && r.targetPhone === cleanPhone))
      );
      if (existingReq) {
        return res.status(400).json({ success: false, message: 'A link request has already been sent to this contact.' });
      }

      const linkReq = {
        _id: 'req_' + Date.now(),
        seniorUserId: seniorUser._id,
        seniorName: seniorUser.name,
        seniorAddress: seniorUser.address || seniorUser.apartmentNumber || 'Springboard Community',
        targetName,
        targetEmail: cleanEmail,
        targetPhone: cleanPhone,
        targetRole,
        relationship: relationship || 'Community Contact',
        responderUserId: existingResponderId,
        requestDate: currentDate,
        status: 'PENDING',
        createdAt: new Date()
      };
      memoryStore.linkRequests.push(linkReq);

      return res.status(201).json({
        success: true,
        message: 'Account Link Request created successfully with status PENDING.',
        linkRequest: linkReq
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
    const isDbConnected = require('mongoose').connection.readyState === 1;
    const userIdStr = (user._id || user.id).toString();
    const userEmail = (user.email || '').toLowerCase();
    const userPhone = user.phone || '';

    if (isDbConnected) {
      const requests = await LinkRequest.find({
        $or: [
          { responderUserId: user._id },
          { targetEmail: userEmail },
          { targetPhone: userPhone }
        ]
      }).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, requests });
    } else {
      const memoryStore = require('../config/memoryStore');
      const requests = memoryStore.linkRequests.filter(r =>
        (r.responderUserId && r.responderUserId.toString() === userIdStr) ||
        (r.targetEmail && r.targetEmail.toLowerCase() === userEmail) ||
        (r.targetPhone && r.targetPhone === userPhone)
      );
      return res.status(200).json({ success: true, requests });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get All Link Requests for Senior Citizen
exports.getSeniorLinkRequests = async (req, res) => {
  try {
    const seniorUser = req.user;
    const isDbConnected = require('mongoose').connection.readyState === 1;
    const seniorIdStr = (seniorUser._id || seniorUser.id).toString();

    if (isDbConnected) {
      const requests = await LinkRequest.find({ seniorUserId: seniorUser._id }).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, requests });
    } else {
      const memoryStore = require('../config/memoryStore');
      const requests = memoryStore.linkRequests.filter(r => r.seniorUserId && r.seniorUserId.toString() === seniorIdStr);
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
    const isDbConnected = require('mongoose').connection.readyState === 1;

    if (isDbConnected) {
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
      const memoryStore = require('../config/memoryStore');
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
    const isDbConnected = require('mongoose').connection.readyState === 1;

    if (isDbConnected) {
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
      const memoryStore = require('../config/memoryStore');
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
    const isDbConnected = require('mongoose').connection.readyState === 1;

    if (isDbConnected) {
      await LinkRequest.findByIdAndDelete(requestId);
      return res.status(200).json({ success: true, message: 'Account unlinked successfully.' });
    } else {
      const memoryStore = require('../config/memoryStore');
      const index = memoryStore.linkRequests.findIndex(r => r._id.toString() === requestId.toString());
      if (index !== -1) memoryStore.linkRequests.splice(index, 1);
      return res.status(200).json({ success: true, message: 'Account unlinked successfully.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

