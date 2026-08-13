const mongoose = require('mongoose');

const neighborSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
    apartmentNumber: { type: String }
  },
  { timestamps: true, bufferCommands: false }
);

module.exports = mongoose.models.Neighbor || mongoose.model('Neighbor', neighborSchema);
