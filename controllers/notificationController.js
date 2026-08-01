const Notification = require('../models/Notification');
const LinkRequest = require('../models/LinkRequest');
const Emergency = require('../models/Emergency');
const User = require('../models/User');
const memoryStore = require('../config/memoryStore');
const mongoose = require('mongoose');

const isDbConnected = () => mongoose.connection.readyState === 1;

// Get User Notifications & Summary Counts
exports.getUserNotifications = async (req, res) => {
  try {
    const user = req.user;

    if (isDbConnected()) {
      const notifications = await Notification.find({
        $or: [
          { recipientUserId: user._id },
          { recipientRole: user.role },
          { targetEmail: user.email.toLowerCase() }
        ]
      }).sort({ createdAt: -1 });

      const pendingCount = notifications.filter(n => n.status === 'PENDING').length;
      const acceptedCount = notifications.filter(n => n.status === 'ACCEPTED').length;
      const readCount = notifications.filter(n => n.status === 'READ').length;
      const unreadCount = notifications.filter(n => n.status === 'PENDING' || n.status === 'UNREAD').length;

      return res.status(200).json({
        success: true,
        counts: {
          pending: pendingCount,
          accepted: acceptedCount,
          read: readCount,
          unread: unreadCount
        },
        notifications
      });
    } else {
      // MemoryStore Fallback
      if (!memoryStore.notifications) memoryStore.notifications = [];

      const notifications = memoryStore.notifications.filter(n =>
        (n.recipientUserId && n.recipientUserId.toString() === user._id.toString()) ||
        n.recipientRole === user.role
      );

      const pendingCount = notifications.filter(n => n.status === 'PENDING').length;
      const acceptedCount = notifications.filter(n => n.status === 'ACCEPTED').length;
      const readCount = notifications.filter(n => n.status === 'READ').length;
      const unreadCount = notifications.filter(n => n.status === 'PENDING' || n.status === 'UNREAD').length;

      return res.status(200).json({
        success: true,
        counts: {
          pending: pendingCount,
          accepted: acceptedCount,
          read: readCount,
          unread: unreadCount
        },
        notifications
      });
    }
  } catch (err) {
    console.error('Get Notifications Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// Accept Notification Connection Request
exports.acceptNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const user = req.user;

    let notif, linkReq;

    if (isDbConnected()) {
      notif = await Notification.findById(notificationId);
      if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

      notif.status = 'ACCEPTED';
      await notif.save();

      if (notif.linkRequestId) {
        linkReq = await LinkRequest.findById(notif.linkRequestId);
        if (linkReq) {
          linkReq.status = 'ACCEPTED';
          linkReq.responderUserId = user._id;
          await linkReq.save();

          // Add accepted user to Senior Citizen's Emergency Contacts list
          const seniorUser = await User.findById(linkReq.seniorUserId);
          if (seniorUser) {
            if (user.role === 'family_member') {
              seniorUser.familyContactName = user.name;
              seniorUser.familyPhone = user.phone;
              seniorUser.familyRelationship = linkReq.relationship || 'Family Member';
            } else if (user.role === 'neighbor') {
              seniorUser.neighborName = user.name;
              seniorUser.neighborPhone = user.phone;
              seniorUser.neighborApartment = user.apartmentNumber || user.address || 'Nearby';
            } else if (user.role === 'security_guard') {
              seniorUser.guardName = user.name;
              seniorUser.guardPhone = user.phone;
            } else if (user.role === 'volunteer') {
              seniorUser.volunteerName = user.name;
              seniorUser.volunteerPhone = user.phone;
            }
            await seniorUser.save();
          }

          // Create notification for Senior Citizen
          const seniorNotif = await Notification.create({
            recipientUserId: linkReq.seniorUserId,
            senderUserId: user._id,
            senderName: user.name,
            senderRole: user.role,
            message: `✅ ${user.name} (${user.role}) accepted your connection request. Added to emergency contacts.`,
            type: 'LINK_ACCEPTED',
            status: 'UNREAD',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          });

          // Trigger Socket.IO event if available
          if (req.app.get('emitToUser')) {
            req.app.get('emitToUser')(linkReq.seniorUserId.toString(), 'LINK_REQUEST_ACCEPTED', {
              responderName: user.name,
              responderRole: user.role,
              notification: seniorNotif
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: `Request accepted! ${user.name} is now connected as an emergency responder.`,
        notification: notif
      });
    } else {
      // Memory Store Fallback
      if (!memoryStore.notifications) memoryStore.notifications = [];
      notif = memoryStore.notifications.find(n => n._id.toString() === notificationId.toString());
      if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

      notif.status = 'ACCEPTED';

      if (notif.linkRequestId) {
        linkReq = memoryStore.linkRequests.find(r => r._id.toString() === notif.linkRequestId.toString());
        if (linkReq) {
          linkReq.status = 'ACCEPTED';
          linkReq.responderUserId = user._id;

          const seniorUser = memoryStore.users.find(u => u._id.toString() === linkReq.seniorUserId.toString());
          if (seniorUser) {
            if (user.role === 'family_member') {
              seniorUser.familyContactName = user.name;
              seniorUser.familyPhone = user.phone;
            } else if (user.role === 'neighbor') {
              seniorUser.neighborName = user.name;
              seniorUser.neighborPhone = user.phone;
            } else if (user.role === 'security_guard') {
              seniorUser.guardName = user.name;
              seniorUser.guardPhone = user.phone;
            } else if (user.role === 'volunteer') {
              seniorUser.volunteerName = user.name;
              seniorUser.volunteerPhone = user.phone;
            }
          }

          const seniorNotif = {
            _id: 'notif_' + Date.now(),
            recipientUserId: linkReq.seniorUserId,
            senderUserId: user._id,
            senderName: user.name,
            senderRole: user.role,
            message: `✅ ${user.name} (${user.role}) accepted your connection request. Added to emergency contacts.`,
            type: 'LINK_ACCEPTED',
            status: 'UNREAD',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date()
          };
          memoryStore.notifications.unshift(seniorNotif);

          if (req.app.get('emitToUser')) {
            req.app.get('emitToUser')(linkReq.seniorUserId.toString(), 'LINK_REQUEST_ACCEPTED', {
              responderName: user.name,
              responderRole: user.role,
              notification: seniorNotif
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: `Request accepted! ${user.name} is now connected.`,
        notification: notif
      });
    }
  } catch (err) {
    console.error('Accept Notification Error:', err);
    res.status(500).json({ success: false, message: 'Failed to accept notification request' });
  }
};

// Decline Notification Connection Request
exports.declineNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const user = req.user;

    let notif, linkReq;

    if (isDbConnected()) {
      notif = await Notification.findById(notificationId);
      if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

      notif.status = 'DECLINED';
      await notif.save();

      if (notif.linkRequestId) {
        linkReq = await LinkRequest.findById(notif.linkRequestId);
        if (linkReq) {
          linkReq.status = 'REJECTED';
          await linkReq.save();

          const seniorNotif = await Notification.create({
            recipientUserId: linkReq.seniorUserId,
            senderUserId: user._id,
            senderName: user.name,
            senderRole: user.role,
            message: `❌ ${user.name} (${user.role}) declined your connection request.`,
            type: 'LINK_DECLINED',
            status: 'UNREAD',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          });

          if (req.app.get('emitToUser')) {
            req.app.get('emitToUser')(linkReq.seniorUserId.toString(), 'LINK_REQUEST_DECLINED', {
              responderName: user.name,
              notification: seniorNotif
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Connection request declined.',
        notification: notif
      });
    } else {
      if (!memoryStore.notifications) memoryStore.notifications = [];
      notif = memoryStore.notifications.find(n => n._id.toString() === notificationId.toString());
      if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

      notif.status = 'DECLINED';

      if (notif.linkRequestId) {
        linkReq = memoryStore.linkRequests.find(r => r._id.toString() === notif.linkRequestId.toString());
        if (linkReq) {
          linkReq.status = 'REJECTED';

          const seniorNotif = {
            _id: 'notif_' + Date.now(),
            recipientUserId: linkReq.seniorUserId,
            senderUserId: user._id,
            senderName: user.name,
            senderRole: user.role,
            message: `❌ ${user.name} (${user.role}) declined your connection request.`,
            type: 'LINK_DECLINED',
            status: 'UNREAD',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date()
          };
          memoryStore.notifications.unshift(seniorNotif);

          if (req.app.get('emitToUser')) {
            req.app.get('emitToUser')(linkReq.seniorUserId.toString(), 'LINK_REQUEST_DECLINED', {
              responderName: user.name,
              notification: seniorNotif
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Connection request declined.',
        notification: notif
      });
    }
  } catch (err) {
    console.error('Decline Notification Error:', err);
    res.status(500).json({ success: false, message: 'Failed to decline notification request' });
  }
};

// Mark Notification as Read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    if (isDbConnected()) {
      await Notification.findByIdAndUpdate(notificationId, { status: 'READ' });
    } else {
      if (memoryStore.notifications) {
        const notif = memoryStore.notifications.find(n => n._id.toString() === notificationId.toString());
        if (notif) notif.status = 'READ';
      }
    }
    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};
