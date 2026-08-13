const mongoose = require('mongoose');

const linkRequestSchema = new mongoose.Schema(
  {
    seniorUserId: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true },
    seniorName: { type: String, required: true },
    seniorAddress: { type: String },
    targetName: { type: String, required: true },
    targetEmail: { type: String, default: '', lowercase: true, trim: true },
    targetPhone: { type: String, default: '', trim: true },
    targetRole: { type: String, required: true },
    relationship: { type: String, default: 'Community Contact' },
    responderUserId: { type: mongoose.Schema.Types.Mixed, ref: 'User' },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' },
    requestDate: { type: String }
  },
  { timestamps: true, bufferCommands: false }
);

linkRequestSchema.index({ targetEmail: 1, status: 1 });
linkRequestSchema.index({ targetPhone: 1, status: 1 });
linkRequestSchema.index({ seniorUserId: 1, status: 1 });
linkRequestSchema.index({ responderUserId: 1, status: 1 });

module.exports = mongoose.models.LinkRequest || mongoose.model('LinkRequest', linkRequestSchema);

