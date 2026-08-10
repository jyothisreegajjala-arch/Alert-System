const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientRole: { type: String },
    targetEmail: { type: String },
    senderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String },
    senderRole: { type: String },
    emergencyType: { type: String },
    address: { type: String },
    apartment: { type: String },
    message: { type: String, required: true },
    type: { type: String, default: 'NOTIFICATION' },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'UNREAD', 'READ'], default: 'PENDING' },
    linkRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'LinkRequest' },
    date: { type: String },
    time: { type: String }
  },
  { timestamps: true, bufferCommands: false }
);

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
