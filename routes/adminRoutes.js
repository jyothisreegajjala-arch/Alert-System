const express = require('express');
const router = express.Router();
const {
  getStats,
  getUsers,
  toggleUserStatus,
  deleteUser,
  getEmergencyReports,
  importUsersCSV,
  exportUsersCSV,
  exportEmergenciesCSV
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(authorizeRoles('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.post('/users/import-csv', importUsersCSV);
router.get('/users/export-csv', exportUsersCSV);
router.get('/emergencies/export-csv', exportEmergenciesCSV);
router.put('/users/:userId/toggle-status', toggleUserStatus);
router.delete('/users/:userId', deleteUser);
router.get('/reports', getEmergencyReports);

module.exports = router;
