const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, forgotPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
