const User = require('../models/User');
const EmergencyContact = require('../models/EmergencyContact');
const Neighbor = require('../models/Neighbor');
const SecurityGuard = require('../models/SecurityGuard');
const Volunteer = require('../models/Volunteer');

exports.getEmergencyContacts = async (req, res) => {
  try {
    const contacts = await EmergencyContact.find({ userId: req.user._id });
    return res.status(200).json({ success: true, contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addEmergencyContact = async (req, res) => {
  try {
    const { contactName, phone, relationship } = req.body;
    const contact = await EmergencyContact.create({ userId: req.user._id, contactName, phone, relationship });
    return res.status(201).json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteEmergencyContact = async (req, res) => {
  try {
    await EmergencyContact.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    return res.status(200).json({ success: true, message: 'Contact removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNeighbors = async (req, res) => {
  try {
    const neighbors = await Neighbor.find().populate('userId', 'name email phone address apartmentNumber active');
    return res.status(200).json({ success: true, neighbors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSecurityGuards = async (req, res) => {
  try {
    const guards = await SecurityGuard.find().populate('userId', 'name email phone dutyStatus active');
    return res.status(200).json({ success: true, guards });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getVolunteers = async (req, res) => {
  try {
    const volunteers = await Volunteer.find().populate('userId', 'name email phone availability address active');
    return res.status(200).json({ success: true, volunteers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
