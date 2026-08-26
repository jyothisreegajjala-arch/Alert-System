const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', notificationController.getUserNotifications);
router.put('/:notificationId/accept', notificationController.acceptNotification);
router.put('/:notificationId/decline', notificationController.declineNotification);
router.put('/:notificationId/read', notificationController.markAsRead);
router.post('/fcm-token', notificationController.registerFCMToken);
router.delete('/fcm-token', notificationController.removeFCMToken);
router.delete('/clear', notificationController.clearNotificationHistory);
router.delete('/', notificationController.clearNotificationHistory);

module.exports = router;
