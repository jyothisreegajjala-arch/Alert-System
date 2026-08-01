const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
    availability: { type: String, default: 'AVAILABLE' }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Volunteer || mongoose.model('Volunteer', volunteerSchema);
