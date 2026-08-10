const User = require('../models/User');
const EmergencyContact = require('../models/EmergencyContact');
const Neighbor = require('../models/Neighbor');
const SecurityGuard = require('../models/SecurityGuard');
const Volunteer = require('../models/Volunteer');

exports.getEmergencyContacts = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let contacts = [];
    if (isDbConnected) {
      contacts = await EmergencyContact.find({ userId: req.user._id });
    } else {
      const memoryStore = require('../config/memoryStore');
      const userIdStr = (req.user._id || req.user.id || '').toString();
      contacts = memoryStore.emergencyContacts.filter(c => c.userId && c.userId.toString() === userIdStr);
    }
    return res.status(200).json({ success: true, contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addEmergencyContact = async (req, res) => {
  try {
    const { contactName, phone, relationship } = req.body;
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let contact;
    if (isDbConnected) {
      contact = await EmergencyContact.create({ userId: req.user._id, contactName, phone, relationship });
    } else {
      const memoryStore = require('../config/memoryStore');
      contact = {
        _id: 'mem_ct_' + Date.now(),
        userId: req.user._id || req.user.id,
        contactName,
        phone,
        relationship
      };
      memoryStore.emergencyContacts.push(contact);
    }
    return res.status(201).json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteEmergencyContact = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    if (isDbConnected) {
      await EmergencyContact.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    } else {
      const memoryStore = require('../config/memoryStore');
      const index = memoryStore.emergencyContacts.findIndex(c => c._id.toString() === req.params.id);
      if (index !== -1) memoryStore.emergencyContacts.splice(index, 1);
    }
    return res.status(200).json({ success: true, message: 'Contact removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNeighbors = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let neighbors = [];
    if (isDbConnected) {
      neighbors = await Neighbor.find().populate('userId', 'name email phone address apartmentNumber active');
    } else {
      const memoryStore = require('../config/memoryStore');
      neighbors = memoryStore.neighbors;
    }
    return res.status(200).json({ success: true, neighbors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSecurityGuards = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let guards = [];
    if (isDbConnected) {
      guards = await SecurityGuard.find().populate('userId', 'name email phone dutyStatus active');
    } else {
      const memoryStore = require('../config/memoryStore');
      guards = memoryStore.securityGuards;
    }
    return res.status(200).json({ success: true, guards });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getVolunteers = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let volunteers = [];
    if (isDbConnected) {
      volunteers = await Volunteer.find().populate('userId', 'name email phone availability address active');
    } else {
      const memoryStore = require('../config/memoryStore');
      volunteers = memoryStore.volunteers;
    }
    return res.status(200).json({ success: true, volunteers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
