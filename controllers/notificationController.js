const Notification = require('../models/Notification');
const LinkRequest = require('../models/LinkRequest');
const User = require('../models/User');

// Get User Notifications & Summary Counts
exports.getUserNotifications = async (req, res) => {
  try {
    const user = req.user;
    const isDbConnected = require('mongoose').connection.readyState === 1;
    let notifications = [];

    if (isDbConnected) {
      let filter = {};
      if (user.role !== 'admin') {
        const orConditions = [
          { recipientUserId: user._id }
        ];
        if (user.email) orConditions.push({ targetEmail: user.email.toLowerCase() });
        if (user.phone) orConditions.push({ targetPhone: user.phone });
        filter = { $or: orConditions };
      }
      notifications = await Notification.find(filter).sort({ createdAt: -1 });
    } else {
      const memoryStore = require('../config/memoryStore');
      const userIdStr = (user._id || user.id || '').toString();
      const userEmail = (user.email || '').toLowerCase();
      const userPhone = user.phone || '';

      if (user.role === 'admin') {
        notifications = (memoryStore.notifications || []);
      } else {
        notifications = (memoryStore.notifications || []).filter(n =>
          (n.recipientUserId && n.recipientUserId.toString() === userIdStr) ||
          (userEmail && n.targetEmail && n.targetEmail.toLowerCase() === userEmail) ||
          (userPhone && n.targetPhone && n.targetPhone === userPhone)
        );
      }
    }

    // Deduplicate notifications so identical alerts created at the same time are shown only ONCE
    const seenKeys = new Set();
    const uniqueNotifications = notifications.filter(n => {
      const sender = n.senderName || (n.senderUserId ? n.senderUserId.toString() : '');
      const type = n.type || 'ALERT';
      const msg = n.message || '';
      const timeVal = n.time || n.date || '';
      const key = `${sender}_${type}_${msg}_${timeVal}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    notifications = uniqueNotifications;

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
    const isDbConnected = require('mongoose').connection.readyState === 1;

    let notif, linkReq;

    if (isDbConnected) {
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

          const seniorNotif = await Notification.create({
            recipientUserId: linkReq.seniorUserId,
            senderUserId: user._id,
            senderName: user.name,
            senderRole: user.role,
            message: `✅ ${user.name} (${user.role}) accepted your connection request. Added to emergency contacts.`,
            type: 'LINK_ACCEPTED',
            status: 'UNREAD',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
          });

          if (req.app.get('emitToUser')) {
            req.app.get('emitToUser')(linkReq.seniorUserId.toString(), 'LINK_REQUEST_ACCEPTED', {
              responderName: user.name,
              responderRole: user.role,
              notification: seniorNotif
            });
          }
        }
      }
    } else {
      const memoryStore = require('../config/memoryStore');
      if (!memoryStore.notifications) memoryStore.notifications = [];
      notif = memoryStore.notifications.find(n => n._id.toString() === notificationId.toString());
      if (notif) notif.status = 'ACCEPTED';
    }

    return res.status(200).json({
      success: true,
      message: `Request accepted! ${user.name} is now connected as an emergency responder.`,
      notification: notif
    });
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
    const isDbConnected = require('mongoose').connection.readyState === 1;

    let notif, linkReq;

    if (isDbConnected) {
      notif = await Notification.findById(notificationId);
      if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

      notif.status = 'DECLINED';
      await notif.save();

      if (notif.linkRequestId) {
        linkReq = await LinkRequest.findById(notif.linkRequestId);
        if (linkReq) {
          linkReq.status = 'REJECTED';
          await linkReq.save();
        }
      }
    } else {
      const memoryStore = require('../config/memoryStore');
      if (!memoryStore.notifications) memoryStore.notifications = [];
      notif = memoryStore.notifications.find(n => n._id.toString() === notificationId.toString());
      if (notif) notif.status = 'DECLINED';
    }

    return res.status(200).json({
      success: true,
      message: 'Connection request declined.',
      notification: notif
    });
  } catch (err) {
    console.error('Decline Notification Error:', err);
    res.status(500).json({ success: false, message: 'Failed to decline notification request' });
  }
};

// Mark Notification as Read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const isDbConnected = require('mongoose').connection.readyState === 1;

    if (isDbConnected) {
      await Notification.findByIdAndUpdate(notificationId, { status: 'READ' });
    } else {
      const memoryStore = require('../config/memoryStore');
      if (!memoryStore.notifications) memoryStore.notifications = [];
      const notif = memoryStore.notifications.find(n => n._id.toString() === notificationId.toString());
      if (notif) notif.status = 'READ';
    }
    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

// Clear Notification History
exports.clearNotificationHistory = async (req, res) => {
  try {
    const isDbConnected = require('mongoose').connection.readyState === 1;

    if (isDbConnected) {
      // Delete all notification documents from MongoDB (including broadcasted SOS alerts and link requests)
      await Notification.deleteMany({});
    }
    
    // Clear in-memory notification store
    const memoryStore = require('../config/memoryStore');
    memoryStore.notifications = [];

    return res.status(200).json({
      success: true,
      message: 'Notification history cleared successfully.'
    });
  } catch (err) {
    console.error('Clear Notifications Error:', err);
    res.status(500).json({ success: false, message: 'Failed to clear notification history' });
  }
};

// Register / Update FCM Device Token
exports.registerFCMToken = async (req, res) => {
  try {
    const { token, platform = 'android' } = req.body;
    const user = req.user;
    if (!token) return res.status(400).json({ success: false, message: 'FCM Token is required' });

    const isDbConnected = require('mongoose').connection.readyState === 1;

    if (isDbConnected) {
      const dbUser = await User.findById(user._id);
      if (dbUser) {
        if (!dbUser.fcmTokens) dbUser.fcmTokens = [];
        const existingIdx = dbUser.fcmTokens.findIndex(t => t.token === token);
        if (existingIdx !== -1) {
          dbUser.fcmTokens[existingIdx].updatedAt = new Date();
          dbUser.fcmTokens[existingIdx].platform = platform;
        } else {
          dbUser.fcmTokens.push({ token, platform, updatedAt: new Date() });
        }
        await dbUser.save();
      }
    } else {
      const memoryStore = require('../config/memoryStore');
      const memUser = (memoryStore.users || []).find(u => String(u._id) === String(user._id || user.id));
      if (memUser) {
        if (!memUser.fcmTokens) memUser.fcmTokens = [];
        const existingIdx = memUser.fcmTokens.findIndex(t => t.token === token);
        if (existingIdx !== -1) {
          memUser.fcmTokens[existingIdx].updatedAt = new Date();
        } else {
          memUser.fcmTokens.push({ token, platform, updatedAt: new Date() });
        }
      }
    }

    return res.status(200).json({ success: true, message: 'FCM device token registered successfully.' });
  } catch (err) {
    console.error('Register FCM Token Error:', err);
    res.status(500).json({ success: false, message: 'Failed to register FCM device token' });
  }
};

// Remove FCM Device Token (on Logout)
exports.removeFCMToken = async (req, res) => {
  try {
    const { token } = req.body;
    const user = req.user;
    const isDbConnected = require('mongoose').connection.readyState === 1;

    if (token) {
      if (isDbConnected) {
        await User.findByIdAndUpdate(user._id, {
          $pull: { fcmTokens: { token } }
        });
      } else {
        const memoryStore = require('../config/memoryStore');
        const memUser = (memoryStore.users || []).find(u => String(u._id) === String(user._id || user.id));
        if (memUser && memUser.fcmTokens) {
          memUser.fcmTokens = memUser.fcmTokens.filter(t => t.token !== token);
        }
      }
    }

    return res.status(200).json({ success: true, message: 'FCM device token removed successfully.' });
  } catch (err) {
    console.error('Remove FCM Token Error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove FCM device token' });
  }
};


