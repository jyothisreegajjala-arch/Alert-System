const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'safereach_super_secret_key_2026_info_sys',
  JWT_EXPIRES_IN: '7d',
  ESCALATION_TIMEOUT_MS: 60000, // 60 seconds countdown
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/safereach'
};
