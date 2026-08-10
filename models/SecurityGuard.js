const mongoose = require('mongoose');

const securityGuardSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    apartment: { type: String },
    dutyStatus: { type: String, default: 'ON_DUTY' }
  },
  { timestamps: true, bufferCommands: false }
);

module.exports = mongoose.models.SecurityGuard || mongoose.model('SecurityGuard', securityGuardSchema);
