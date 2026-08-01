const mongoose = require('mongoose');

const linkRequestSchema = new mongoose.Schema(
  {
    seniorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seniorName: { type: String, required: true },
    seniorAddress: { type: String },
    targetName: { type: String, required: true },
    targetEmail: { type: String, required: true, lowercase: true },
    targetPhone: { type: String, required: true },
    targetRole: { type: String, required: true },
    relationship: { type: String, default: 'Community Contact' },
    responderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' },
    requestDate: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.models.LinkRequest || mongoose.model('LinkRequest', linkRequestSchema);
