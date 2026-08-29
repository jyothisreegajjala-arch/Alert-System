const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
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

// Serve static frontend files with no-cache headers across possible root locations
const staticLocations = [
  path.join(__dirname, 'public'),
  path.join(process.cwd(), 'public'),
  path.join(__dirname, '..', 'public'),
  path.join(process.cwd(), 'dist', 'public')
];
staticLocations.forEach(sp => {
  if (fs.existsSync(sp)) {
    app.use('/public', express.static(sp, {
      etag: false,
      maxAge: 0,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
      }
    }));
  }
});

// Explicit static route handler fallback for serverless environments
app.get('/public/*', (req, res, next) => {
  const reqPath = req.params[0];
  const candidates = [
    path.join(__dirname, 'public', reqPath),
    path.join(process.cwd(), 'public', reqPath),
    path.join(__dirname, '..', 'public', reqPath),
    path.join(process.cwd(), 'dist', 'public', reqPath),
    path.join(__dirname, 'dist', 'public', reqPath)
  ];
  const found = candidates.find(c => fs.existsSync(c));
  if (found) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
    if (reqPath.endsWith('.css')) res.type('text/css');
    else if (reqPath.endsWith('.js')) res.type('application/javascript');
    else if (reqPath.endsWith('.png')) res.type('image/png');
    else if (reqPath.endsWith('.svg')) res.type('image/svg+xml');
    else if (reqPath.endsWith('.apk')) {
      res.type('application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(found)}"`);
    }
    const data = fs.readFileSync(found);
    return res.send(data);
  }
  next();
});

const serveView = (relPath) => (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
  res.type('text/html');
  const candidates = [
    path.join(__dirname, 'views', relPath),
    path.join(process.cwd(), 'views', relPath),
    path.join(__dirname, '..', 'views', relPath),
    path.join(process.cwd(), 'dist', 'views', relPath),
    path.join(process.cwd(), 'dist', relPath),
    path.join(__dirname, 'dist', 'views', relPath),
    path.join(__dirname, 'dist', relPath)
  ];
  const found = candidates.find(c => fs.existsSync(c));
  if (found) {
    const html = fs.readFileSync(found, 'utf8');
    return res.send(html);
  }
  res.status(404).send(`View ${relPath} not found`);
};

// Serve view HTML files directly with array route aliases
app.get(['/download', '/download.html'], serveView('download.html'));

app.get(['/app-release.apk', '/public/app-release.apk'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="app-release.apk"');

  const possiblePaths = [
    path.join(process.cwd(), 'public', 'app-release.apk'),
    path.join(__dirname, 'public', 'app-release.apk'),
    path.join(__dirname, '..', 'public', 'app-release.apk'),
    path.join(process.cwd(), 'dist', 'public', 'app-release.apk'),
    path.join(process.cwd(), 'dist', 'app-release.apk')
  ];

  const foundPath = possiblePaths.find(p => fs.existsSync(p));
  if (foundPath) {
    const stat = fs.statSync(foundPath);
    res.setHeader('Content-Length', stat.size);
    return fs.createReadStream(foundPath).pipe(res);
  }
  res.status(404).send('Release APK file not found on server');
});

app.get(['/app-debug.apk', '/public/app-debug.apk'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="app-debug.apk"');

  const possiblePaths = [
    path.join(process.cwd(), 'public', 'app-debug.apk'),
    path.join(__dirname, 'public', 'app-debug.apk'),
    path.join(__dirname, '..', 'public', 'app-debug.apk'),
    path.join(process.cwd(), 'dist', 'public', 'app-debug.apk'),
    path.join(process.cwd(), 'dist', 'app-debug.apk')
  ];

  const foundPath = possiblePaths.find(p => fs.existsSync(p));
  if (foundPath) {
    const stat = fs.statSync(foundPath);
    res.setHeader('Content-Length', stat.size);
    return fs.createReadStream(foundPath).pipe(res);
  }
  res.status(404).send('Debug APK file not found on server');
});

app.get(['/language', '/language.html'], serveView('language.html'));
app.get(['/', '/index.html'], serveView('index.html'));
app.get(['/login', '/login.html'], serveView('login.html'));
app.get(['/login/senior', '/login/senior.html'], serveView(path.join('login', 'senior.html')));
app.get(['/login/child', '/login/child.html'], serveView(path.join('login', 'child.html')));
app.get(['/login/family', '/login/family.html'], serveView(path.join('login', 'family.html')));
app.get(['/login/neighbor', '/login/neighbor.html'], serveView(path.join('login', 'neighbor.html')));
app.get(['/login/security', '/login/security.html'], serveView(path.join('login', 'security.html')));
app.get(['/login/volunteer', '/login/volunteer.html'], serveView(path.join('login', 'volunteer.html')));
app.get(['/login/admin', '/login/admin.html'], serveView(path.join('login', 'admin.html')));
app.get(['/register', '/register.html'], serveView('register.html'));
app.get(['/dashboard', '/dashboard.html', '/dashboard/'], serveView('dashboard.html'));
app.get(['/dashboard/senior', '/dashboard/senior.html'], serveView('dashboard.html'));
app.get(['/dashboard/family', '/dashboard/family.html'], serveView('dashboard.html'));
app.get(['/dashboard/child', '/dashboard/child.html'], serveView('dashboard.html'));
app.get(['/dashboard/neighbor', '/dashboard/neighbor.html'], serveView('dashboard.html'));
app.get(['/dashboard/security', '/dashboard/security.html'], serveView('dashboard.html'));
app.get(['/dashboard/volunteer', '/dashboard/volunteer.html'], serveView('dashboard.html'));
app.get(['/dashboard/admin', '/dashboard/admin.html', '/admin', '/admin.html', '/admin/'], serveView('admin.html'));

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
        const notifObj = {
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
        };

        if (isDb) {
          const tenSecAgo = new Date(now.getTime() - 10000);
          const existingNotif = await Notification.findOne({
            recipientUserId: rId,
            senderUserId: emergency.userId,
            type: 'EMERGENCY_ALERT',
            createdAt: { $gte: tenSecAgo }
          });

          if (!existingNotif) {
            const created = await Notification.create(notifObj);
            io.to(`room:user:${rId}`).emit('NEW_NOTIFICATION', created);
          }
        } else {
          const recentNotif = (memoryStore.notifications || []).find(n =>
            String(n.recipientUserId) === String(rId) &&
            String(n.senderUserId) === String(emergency.userId) &&
            n.type === 'EMERGENCY_ALERT' &&
            n.time === timeStr
          );
          if (!recentNotif) {
            notifObj._id = 'notif_sos_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            memoryStore.notifications.push(notifObj);
            io.to(`room:user:${rId}`).emit('NEW_NOTIFICATION', notifObj);
          }
        }
      }
    }

    // Also record an in-app message notification for the SOS trigger user
    try {
      const selfNotif = {
        recipientUserId: emergency.userId,
        senderUserId: emergency.userId,
        senderName: emergency.userName,
        type: 'EMERGENCY_ALERT',
        title: `🚨 SOS Alert Broadcasted`,
        message: `Your SOS Emergency Alert (${emergency.alertId}) was successfully sent to your connected responders and active community network.`,
        status: 'UNREAD',
        createdAt: now,
        date: dateStr,
        time: timeStr
      };
      if (isDb) {
        const createdSelf = await Notification.create(selfNotif);
        io.to(`room:user:${emergency.userId}`).emit('NEW_NOTIFICATION', createdSelf);
      } else {
        selfNotif._id = 'notif_sos_self_' + Date.now();
        memoryStore.notifications.push(selfNotif);
        io.to(`room:user:${emergency.userId}`).emit('NEW_NOTIFICATION', selfNotif);
      }
    } catch (e) {}

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

