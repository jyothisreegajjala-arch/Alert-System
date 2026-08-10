const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, token missing' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const isDbConnected = require('mongoose').connection.readyState === 1;

    if (isDbConnected) {
      try {
        req.user = await User.findById(decoded.id);
      } catch (e) {
        req.user = null;
      }
    }

    if (!req.user) {
      const memoryStore = require('../config/memoryStore');
      req.user = memoryStore.users.find(u => (u._id && u._id.toString() === decoded.id.toString()) || (u.id && u.id.toString() === decoded.id.toString())) || {
        _id: decoded.id,
        name: 'Demo User',
        email: 'demo@safereach.com',
        role: 'senior_citizen',
        active: true
      };
    }

    if (!req.user || req.user.active === false) {
      return res.status(401).json({ success: false, message: 'User account not found or deactivated' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
};

module.exports = { protect };
