const express = require('express');
const router = express.Router();
const {
  triggerSOS,
  acceptEmergency,
  rejectEmergency,
  resolveEmergency,
  cancelEmergency,
  getActiveEmergencies,
  getEmergencyHistory
} = require('../controllers/emergencyController');
const { protect } = require('../middleware/authMiddleware');

router.post('/trigger', protect, triggerSOS);
router.put('/accept/:emergencyId', protect, acceptEmergency);
router.post('/reject/:emergencyId', protect, rejectEmergency);
router.put('/resolve/:emergencyId', protect, resolveEmergency);
router.put('/cancel/:emergencyId', protect, cancelEmergency);
router.get('/active', protect, getActiveEmergencies);
router.get('/history', protect, getEmergencyHistory);

module.exports = router;
