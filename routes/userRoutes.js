const express = require('express');
const router = express.Router();
const {
  getEmergencyContacts,
  addEmergencyContact,
  deleteEmergencyContact,
  getNeighbors,
  getSecurityGuards,
  getVolunteers
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.get('/contacts', protect, getEmergencyContacts);
router.post('/contacts', protect, addEmergencyContact);
router.delete('/contacts/:id', protect, deleteEmergencyContact);

router.get('/neighbors', protect, getNeighbors);
router.get('/security-guards', protect, getSecurityGuards);
router.get('/volunteers', protect, getVolunteers);

module.exports = router;
