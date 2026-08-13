const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true },
    contactName: { type: String, required: true },
    phone: { type: String, required: true },
    relationship: { type: String, default: 'Contact' },
    familyUserId: { type: mongoose.Schema.Types.Mixed, ref: 'User' }
  },
  { timestamps: true, bufferCommands: false }
);

module.exports = mongoose.models.EmergencyContact || mongoose.model('EmergencyContact', emergencyContactSchema);
