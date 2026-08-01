const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema(
  {
    alertId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userPhone: { type: String },
    userRole: { type: String },
    address: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    date: { type: String },
    time: { type: String },
    emergencyType: { type: String, default: 'Medical & Safety Emergency (SOS)' },
    medicalInfo: { type: String, default: 'None' },
    status: {
      type: String,
      enum: ['PENDING_LOCAL', 'ACCEPTED', 'ESCALATED_VOLUNTEER', 'RESOLVED', 'CANCELLED'],
      default: 'PENDING_LOCAL'
    },
    tier1Notified: { type: Boolean, default: true },
    tier2Notified: { type: Boolean, default: false },
    acceptedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
      phone: { type: String },
      role: { type: String }
    },
    acceptedAt: { type: Date },
    responseTimeSeconds: { type: Number, default: 0 },
    escalatedAt: { type: Date },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String, default: '' },
    googleMapsUrl: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Emergency || mongoose.model('Emergency', emergencySchema);
