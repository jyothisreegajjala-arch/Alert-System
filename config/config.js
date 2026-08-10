const dotenv = require('dotenv');
dotenv.config();

const DEFAULT_MONGO_URI = 'mongodb+srv://jyothisreegajjala_db_user:Chitti%407739@cluster0.gvxao6d.mongodb.net/safereach?retryWrites=true&w=majority&appName=Cluster0';

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'safereach_super_secret_key_2026_info_sys',
  JWT_EXPIRES_IN: '7d',
  ESCALATION_TIMEOUT_MS: 60000, // 60 seconds countdown
  MONGO_URI: process.env.MONGO_URI || DEFAULT_MONGO_URI
};
