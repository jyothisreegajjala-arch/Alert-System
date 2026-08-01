const User = require('../models/User');
const EmergencyContact = require('../models/EmergencyContact');
const Neighbor = require('../models/Neighbor');
const SecurityGuard = require('../models/SecurityGuard');
const Volunteer = require('../models/Volunteer');
const memoryStore = require('../config/memoryStore');
const mongoose = require('mongoose');

const isDbConnected = () => mongoose.connection.readyState === 1;

exports.getEmergencyContacts = async (req, res) => {
  try {
    if (isDbConnected()) {
      const contacts = await EmergencyContact.find({ userId: req.user._id });
      return res.status(200).json({ success: true, contacts });
    } else {
      const contacts = memoryStore.emergencyContacts.filter(c => c.userId.toString() === req.user._id.toString());
      return res.status(200).json({ success: true, contacts });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addEmergencyContact = async (req, res) => {
  try {
    const { contactName, phone, relationship } = req.body;
    if (isDbConnected()) {
      const contact = await EmergencyContact.create({ userId: req.user._id, contactName, phone, relationship });
      return res.status(201).json({ success: true, contact });
    } else {
      const contact = { _id: 'cnt_' + Date.now(), userId: req.user._id, contactName, phone, relationship };
      memoryStore.emergencyContacts.push(contact);
      return res.status(201).json({ success: true, contact });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteEmergencyContact = async (req, res) => {
  try {
    if (isDbConnected()) {
      await EmergencyContact.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
      return res.status(200).json({ success: true, message: 'Contact removed' });
    } else {
      const idx = memoryStore.emergencyContacts.findIndex(c => c._id.toString() === req.params.id);
      if (idx !== -1) memoryStore.emergencyContacts.splice(idx, 1);
      return res.status(200).json({ success: true, message: 'Contact removed' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNeighbors = async (req, res) => {
  try {
    if (isDbConnected()) {
      const neighbors = await Neighbor.find().populate('userId', 'name email phone address apartmentNumber active');
      return res.status(200).json({ success: true, neighbors });
    } else {
      return res.status(200).json({ success: true, neighbors: memoryStore.neighbors });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSecurityGuards = async (req, res) => {
  try {
    if (isDbConnected()) {
      const guards = await SecurityGuard.find().populate('userId', 'name email phone dutyStatus active');
      return res.status(200).json({ success: true, guards });
    } else {
      return res.status(200).json({ success: true, guards: memoryStore.securityGuards });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getVolunteers = async (req, res) => {
  try {
    if (isDbConnected()) {
      const volunteers = await Volunteer.find().populate('userId', 'name email phone availability address active');
      return res.status(200).json({ success: true, volunteers });
    } else {
      return res.status(200).json({ success: true, volunteers: memoryStore.volunteers });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
