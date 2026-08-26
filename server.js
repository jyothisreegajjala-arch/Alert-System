const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('./config/config');
const connectDB = require('./config/db');
const User = require('./models/User');
const Neighbor = require('./models/Neighbor');
const SecurityGuard = require('./models/SecurityGuard');
const Volunteer = require('./models/Volunteer');
const EmergencyContact = require('./models/EmergencyContact');
const Emergency = require('./models/Emergency');
const LinkRequest = require('./models/LinkRequest');
const mongoose = require('mongoose');
const memoryStore = require('./config/memoryStore');

const isDbConnected = () => mongoose.connection.readyState === 1;

// Initialize app & server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure MongoDB Atlas connection before handling any request
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Disable caching for all responses to ensure Vercel live deployments update instantly
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static frontend files with no-cache headers
app.use('/public', express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
  }
}));
app.use('/views', express.static(path.join(__dirname, 'views'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
  }
}));

// Serve view HTML files directly with array route aliases
app.get(['/download', '/download.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'download.html')));
app.get(['/app-release.apk', '/public/app-release.apk'], (req, res) => {
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="app-release.apk"');
  res.sendFile(path.join(__dirname, 'public', 'app-release.apk'));
});
app.get(['/language', '/language.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'language.html')));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get(['/login', '/login.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get(['/login/senior', '/login/senior.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login', 'senior.html')));
app.get(['/login/child', '/login/child.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login', 'child.html')));
app.get(['/login/family', '/login/family.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login', 'family.html')));
app.get(['/login/neighbor', '/login/neighbor.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login', 'neighbor.html')));
app.get(['/login/security', '/login/security.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login', 'security.html')));
app.get(['/login/volunteer', '/login/volunteer.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login', 'volunteer.html')));
app.get(['/login/admin', '/login/admin.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login', 'admin.html')));
app.get(['/register', '/register.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get(['/dashboard', '/dashboard.html', '/dashboard/'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
app.get(['/admin', '/admin.html', '/admin/'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/emergency', require('./routes/emergencyRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/link-requests', require('./routes/linkRequestRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// ----------------------------------------------------
// Database Cleanup Helper (Purges all stored data)
// ----------------------------------------------------

const clearAllDatabaseData = async () => {
  if (!isDbConnected()) return;
  try {
    const Notification = require('./models/Notification');
    const LinkRequest = require('./models/LinkRequest');

    await User.deleteMany({});
    await LinkRequest.deleteMany({});
    await Emergency.deleteMany({});
    await Neighbor.deleteMany({});
    await SecurityGuard.deleteMany({});
    await Volunteer.deleteMany({});
    await EmergencyContact.deleteMany({});
    try { await Notification.deleteMany({}); } catch (e) {}

    console.log('[Database Clean] All MongoDB user accounts, login credentials, link requests, and emergency data have been permanently removed.');
  } catch (err) {
    console.error('[Database Clean Error]:', err.message);
  }
};

// ----------------------------------------------------
// Private Targeted 60-Second Real-Time Escalation Engine & Socket.IO
// ----------------------------------------------------

const activeEscalationTimers = new Map();

// Helper to find user IDs of responders linked to a Senior Citizen with ACCEPTED status
const getLinkedResponderUserIds = async (seniorUserId, targetRoles) => {
  const userIds = new Set();
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    const seniorIdStr = seniorUserId.toString();

    if (isDbConnected) {
      // Find ONLY LinkRequests with status 'ACCEPTED'
      const query = { seniorUserId, status: 'ACCEPTED' };
      if (targetRoles && targetRoles.length > 0) {
        query.targetRole = { $in: targetRoles };
      }
      const links = await LinkRequest.find(query);

      for (const link of links) {
        if (link.responderUserId) {
          userIds.add(link.responderUserId.toString());
        } else {
          const check = [];
          if (link.targetEmail && link.targetEmail.trim().length > 3 && !link.targetEmail.includes('@safereach.com')) {
            check.push({ email: link.targetEmail.trim().toLowerCase() });
          }
          if (link.targetPhone && link.targetPhone.trim().length >= 5 && link.targetPhone !== '9876543210') {
            check.push({ phone: link.targetPhone.trim() });
          }
          if (check.length > 0) {
            const matchUser = await User.findOne({ $or: check });
            if (matchUser) userIds.add(matchUser._id.toString());
          }
        }
      }
    } else {
      const memoryStore = require('./config/memoryStore');
      const links = (memoryStore.linkRequests || []).filter(l =>
        l.seniorUserId && l.seniorUserId.toString() === seniorIdStr &&
        l.status === 'ACCEPTED' &&
        (!targetRoles || targetRoles.includes(l.targetRole))
      );

      for (const link of links) {
        if (link.responderUserId) {
          userIds.add(link.responderUserId.toString());
        } else {
          const matchUser = (memoryStore.users || []).find(u =>
            (u.email && link.targetEmail && link.targetEmail.trim().length > 3 && u.email.toLowerCase() === link.targetEmail.trim().toLowerCase()) ||
            (u.phone && link.targetPhone && link.targetPhone.trim().length >= 5 && link.targetPhone !== '9876543210' && u.phone === link.targetPhone.trim())
          );
          if (matchUser) userIds.add(matchUser._id.toString());
        }
      }
    }
  } catch (err) {
    console.error('getLinkedResponderUserIds Error:', err);
  }
  return Array.from(userIds);
};

const Notification = require('./models/Notification');

const handleSOSTrigger = async (emergency) => {
  console.log(`[SOS Triggered] Alert ID: ${emergency.alertId} by ${emergency.userName}`);

  const googleMapsUrl = `https://www.google.com/maps?q=${emergency.latitude},${emergency.longitude}`;
  emergency.googleMapsUrl = googleMapsUrl;

  // Get ONLY connected network members with ACCEPTED connection status
  const allLinkedResponderIds = await getLinkedResponderUserIds(emergency.userId);
  console.log(`[SOS Alert] Sending alert to ${allLinkedResponderIds.length} connected network members with ACCEPTED links.`);

  const isDb = mongoose.connection.readyState === 1;
  const recipientList = Array.from(new Set(allLinkedResponderIds));

  const alertPayload = {
    tier: 1,
    emergency,
    googleMapsUrl,
    countdownSeconds: 60,
    message: `🚨 URGENT SOS ALERT from ${emergency.userName} (${emergency.address}) at ${emergency.time || 'just now'}! GPS: ${emergency.latitude},${emergency.longitude}`
  };

  // 1. Emit Socket.IO real-time alert to all connected members
  recipientList.forEach(rId => {
    io.to(`room:user:${rId}`).emit('NEW_EMERGENCY_ALERT', alertPayload);
    io.to(`room:user:${rId}`).emit('EMERGENCY_ESCALATED', alertPayload);
  });
  io.to('room:admin').emit('NEW_EMERGENCY_ALERT', alertPayload);

  io.to(`room:user:${emergency.userId}`).emit('SOS_STATUS_UPDATE', {
    status: 'PENDING_LOCAL',
    emergency,
    googleMapsUrl,
    message: 'SOS Alert active! Alerting your connected members and emergency responders...'
  });

  // 2. Store in-app Notifications for all connected members (with deduplication)
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

    for (const rId of recipientList) {
      if (String(rId) !== String(emergency.userId)) {
        if (isDb) {
          const tenSecAgo = new Date(now.getTime() - 10000);
          const existingNotif = await Notification.findOne({
            recipientUserId: rId,
            senderUserId: emergency.userId,
            type: 'EMERGENCY_ALERT',
            createdAt: { $gte: tenSecAgo }
          });

          if (!existingNotif) {
            await Notification.create({
              recipientUserId: rId,
              senderUserId: emergency.userId,
              senderName: emergency.userName,
              type: 'EMERGENCY_ALERT',
              title: `🚨 EMERGENCY ALERT: ${emergency.userName}`,
              message: `URGENT! ${emergency.userName} triggered an SOS emergency alert at ${emergency.address}. Location: ${googleMapsUrl}`,
              status: 'PENDING',
              createdAt: now,
              date: dateStr,
              time: timeStr
            });
          }
        } else {
          const recentNotif = (memoryStore.notifications || []).find(n =>
            String(n.recipientUserId) === String(rId) &&
            String(n.senderUserId) === String(emergency.userId) &&
            n.type === 'EMERGENCY_ALERT' &&
            n.time === timeStr
          );
          if (!recentNotif) {
            memoryStore.notifications.push({
              _id: 'notif_sos_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
              recipientUserId: rId,
              senderUserId: emergency.userId,
              senderName: emergency.userName,
              type: 'EMERGENCY_ALERT',
              title: `🚨 EMERGENCY ALERT: ${emergency.userName}`,
              message: `URGENT! ${emergency.userName} triggered an SOS emergency alert at ${emergency.address}. Location: ${googleMapsUrl}`,
              status: 'PENDING',
              createdAt: now,
              date: dateStr,
              time: timeStr
            });
          }
        }
      }
    }

    // 3. Requirement 3 & 17 & 18: Dispatch FCM Push Notifications to Volunteers, NGOs, Admins & Linked Responders
    const { sendFCMPushNotification } = require('./config/firebase');
    const fcmRecipients = recipientList.filter(id => String(id) !== String(emergency.userId));
    
    // Also include active Volunteers and Admins if available
    try {
      if (isDb) {
        const volunteers = await User.find({ role: { $in: ['volunteer', 'admin'] }, active: true }).select('_id');
        volunteers.forEach(v => fcmRecipients.push(v._id.toString()));
      }
    } catch (e) {}

    const uniqueFcmRecipients = Array.from(new Set(fcmRecipients));
    if (uniqueFcmRecipients.length > 0) {
      await sendFCMPushNotification(
        uniqueFcmRecipients,
        {
          title: `🚨 SafeReach Emergency Alert`,
          body: `Senior citizen ${emergency.userName} triggered an SOS! Emergency ID: ${emergency.alertId}`
        },
        {
          emergencyId: (emergency._id || '').toString(),
          alertId: emergency.alertId || '',
          type: 'EMERGENCY_ALERT',
          seniorCitizenId: (emergency.userId || '').toString(),
          latitude: String(emergency.latitude || 12.9716),
          longitude: String(emergency.longitude || 77.5946)
        }
      );
    }
  } catch (notifErr) {
    console.error('[SOS Notification Error]:', notifErr);
  }

  // Start 60-second escalation timer
  const timerId = setTimeout(async () => {
    try {
      let currentAlert;
      if (isDb) {
        currentAlert = await Emergency.findById(emergency._id);
      } else {
        currentAlert = memoryStore.emergencies.find(e => e._id.toString() === emergency._id.toString());
      }

      if (currentAlert && currentAlert.status === 'PENDING_LOCAL') {
        console.log(`[Escalation Timer Fired] Alert ID ${emergency.alertId} timed out after 60s without acceptance.`);

        currentAlert.status = 'ESCALATED_VOLUNTEER';
        currentAlert.tier2Notified = true;
        currentAlert.escalatedAt = new Date();

        if (isDb) {
          await currentAlert.save();
        }

        const alertObj = currentAlert.toObject ? currentAlert.toObject() : { ...currentAlert };
        alertObj.googleMapsUrl = googleMapsUrl;

        const escalatedPayload = {
          tier: 2,
          emergency: alertObj,
          googleMapsUrl,
          message: `⚠️ ESCALATED EMERGENCY! No response within 60s for ${currentAlert.userName}. Location: ${googleMapsUrl}`
        };

        recipientList.forEach(rId => {
          io.to(`room:user:${rId}`).emit('EMERGENCY_ESCALATED', escalatedPayload);
        });
        io.to('room:admin').emit('EMERGENCY_ESCALATED', escalatedPayload);

        io.to(`room:user:${emergency.userId}`).emit('SOS_STATUS_UPDATE', {
          status: 'ESCALATED_VOLUNTEER',
          emergency: alertObj,
          googleMapsUrl,
          message: '60 seconds elapsed. Alert automatically escalated to your linked Family Members and Volunteers!'
        });
      }
    } catch (err) {
      console.error('Error during auto-escalation timer execution:', err);
    } finally {
      activeEscalationTimers.delete(emergency.alertId);
    }
  }, config.ESCALATION_TIMEOUT_MS);

  activeEscalationTimers.set(emergency.alertId, timerId);
};

const handleSOSAccept = async (emergency) => {
  console.log(`[SOS Accepted] Alert ID ${emergency.alertId} accepted by ${emergency.acceptedBy.name} (${emergency.acceptedBy.role})`);

  if (activeEscalationTimers.has(emergency.alertId)) {
    clearTimeout(activeEscalationTimers.get(emergency.alertId));
    activeEscalationTimers.delete(emergency.alertId);
    console.log(`[Escalation Timer Cancelled] Alert ID ${emergency.alertId} accepted in time.`);
  }

  const updatePayload = {
    emergency,
    message: `Help is on the way! ${emergency.acceptedBy.name} (${emergency.acceptedBy.role}) accepted your emergency alert.`
  };

  const allLinkedResponderIds = await getLinkedResponderUserIds(emergency.userId, null);

  // Update stored notification status from PENDING to ACCEPTED
  try {
    if (isDb) {
      await Notification.updateMany(
        { senderUserId: emergency.userId, type: 'EMERGENCY_ALERT' },
        { status: 'ACCEPTED', title: `✅ EMERGENCY ACCEPTED: ${emergency.userName}` }
      );
    } else {
      (memoryStore.notifications || []).forEach(n => {
        if (String(n.senderUserId) === String(emergency.userId) && n.type === 'EMERGENCY_ALERT') {
          n.status = 'ACCEPTED';
          n.title = `✅ EMERGENCY ACCEPTED: ${emergency.userName}`;
        }
      });
    }
  } catch (err) {
    console.error('Error updating notification status on accept:', err);
  }

  // Notify Senior Citizen & Linked Responders
  io.to(`room:user:${emergency.userId}`).emit('SOS_ACCEPTED_BY_HELPER', updatePayload);
  allLinkedResponderIds.forEach(rId => {
    io.to(`room:user:${rId}`).emit('EMERGENCY_ACCEPTED', updatePayload);
    io.to(`room:user:${rId}`).emit('HELPER_ASSIGNED', {
      alertId: emergency.alertId,
      emergencyId: emergency._id,
      helperName: emergency.acceptedBy.name,
      helperRole: emergency.acceptedBy.role,
      message: `Helper Assigned: Emergency accepted by ${emergency.acceptedBy.name} (${emergency.acceptedBy.role})`
    });
    io.to(`room:user:${rId}`).emit('EMERGENCY_STATUS_CHANGED', { emergency });
  });

  io.to('room:admin').emit('EMERGENCY_ACCEPTED', updatePayload);
};

const handleSOSResolve = async (emergency) => {
  console.log(`[SOS Resolved] Alert ID ${emergency.alertId}`);
  if (activeEscalationTimers.has(emergency.alertId)) {
    clearTimeout(activeEscalationTimers.get(emergency.alertId));
    activeEscalationTimers.delete(emergency.alertId);
  }

  const allLinkedResponderIds = await getLinkedResponderUserIds(emergency.userId, null);
  const payload = { emergency, message: `Emergency ${emergency.alertId} has been marked as RESOLVED.` };

  io.to(`room:user:${emergency.userId}`).emit('EMERGENCY_RESOLVED', payload);
  allLinkedResponderIds.forEach(rId => {
    io.to(`room:user:${rId}`).emit('EMERGENCY_RESOLVED', payload);
  });
  io.to('room:admin').emit('EMERGENCY_RESOLVED', payload);
};

const handleSOSCancel = async (emergency) => {
  if (activeEscalationTimers.has(emergency.alertId)) {
    clearTimeout(activeEscalationTimers.get(emergency.alertId));
    activeEscalationTimers.delete(emergency.alertId);
  }

  const allLinkedResponderIds = await getLinkedResponderUserIds(emergency.userId, null);
  const payload = { emergency };

  io.to(`room:user:${emergency.userId}`).emit('EMERGENCY_CANCELLED', payload);
  allLinkedResponderIds.forEach(rId => {
    io.to(`room:user:${rId}`).emit('EMERGENCY_CANCELLED', payload);
  });
  io.to('room:admin').emit('EMERGENCY_CANCELLED', payload);
};

const emitNotification = (data) => {
  const { recipientUserId, recipientRole, notification } = data;
  if (recipientUserId) {
    io.to(`room:user:${recipientUserId}`).emit('NEW_NOTIFICATION', notification);
  }
  if (recipientRole) {
    io.to(`room:${recipientRole}`).emit('NEW_NOTIFICATION', notification);
  }
};

const emitToUser = (userId, eventName, payload) => {
  io.to(`room:user:${userId}`).emit(eventName, payload);
};

app.set('handleSOSTrigger', handleSOSTrigger);
app.set('handleSOSAccept', handleSOSAccept);
app.set('handleSOSResolve', handleSOSResolve);
app.set('handleSOSCancel', handleSOSCancel);
app.set('emitNotification', emitNotification);
app.set('emitToUser', emitToUser);

io.on('connection', (socket) => {
  console.log(`[Socket Connected] Socket ID: ${socket.id}`);

  socket.on('join_rooms', (data) => {
    if (!data) return;
    const { userId, role } = data;

    if (role) {
      socket.join(`room:${role}`);
      console.log(`Socket ${socket.id} joined room:room:${role}`);
    }
    if (userId) {
      socket.join(`room:user:${userId}`);
      console.log(`Socket ${socket.id} joined room:room:user:${userId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] Socket ID: ${socket.id}`);
  });
});

// Connect Database for Vercel serverless environment
if (process.env.VERCEL) {
  connectDB();
}

// Start Server locally
if (!process.env.VERCEL) {
  server.listen(config.PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 SafeReach Server is Running on http://localhost:${config.PORT}`);
    console.log(`=======================================================`);

    connectDB().then((connected) => {
      if (!connected) {
        console.log('[Server] Operating with Memory Store fallback until MONGO_URI is configured in .env');
      }
    });
  });
}

module.exports = app;

