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

// Serve static frontend files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'views')));

// Serve view HTML files directly with array route aliases
app.get(['/language', '/language.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'language.html')));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get(['/login', '/login.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get(['/login/senior', '/login/senior.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login', 'senior.html')));
app.get(['/login/child', '/login/child.html'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login', 'senior.html')));
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
      const query = { seniorUserId, status: 'ACCEPTED' };
      if (targetRoles && targetRoles.length > 0) {
        query.targetRole = { $in: targetRoles };
      }
      const acceptedLinks = await LinkRequest.find(query);

      for (const link of acceptedLinks) {
        if (link.responderUserId) {
          userIds.add(link.responderUserId.toString());
        } else {
          const matchUser = await User.findOne({
            $or: [{ email: link.targetEmail }, { phone: link.targetPhone }]
          });
          if (matchUser) userIds.add(matchUser._id.toString());
        }
      }
    } else {
      const acceptedLinks = memoryStore.linkRequests.filter(l =>
        l.seniorUserId && l.seniorUserId.toString() === seniorIdStr &&
        l.status === 'ACCEPTED' &&
        (!targetRoles || targetRoles.includes(l.targetRole))
      );

      for (const link of acceptedLinks) {
        if (link.responderUserId) {
          userIds.add(link.responderUserId.toString());
        } else {
          const matchUser = memoryStore.users.find(u =>
            (u.email && u.email.toLowerCase() === link.targetEmail.toLowerCase()) ||
            (u.phone && u.phone === link.targetPhone)
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

const handleSOSTrigger = async (emergency) => {
  console.log(`[SOS Triggered] Alert ID: ${emergency.alertId} by ${emergency.userName}`);

  const googleMapsUrl = `https://www.google.com/maps?q=${emergency.latitude},${emergency.longitude}`;
  emergency.googleMapsUrl = googleMapsUrl;

  // Tier 1: Notify ONLY linked Neighbors and Security Guards
  const tier1ResponderIds = await getLinkedResponderUserIds(emergency.userId, ['neighbor', 'security_guard']);
  console.log(`[Tier 1 SOS Alert] Sending alert to ${tier1ResponderIds.length} linked local responders (Neighbors/Guards).`);

  const alertPayload = {
    tier: 1,
    emergency,
    googleMapsUrl,
    countdownSeconds: 60,
    message: `🚨 URGENT SOS ALERT from ${emergency.userName} (${emergency.address}) at ${emergency.time || 'just now'}! GPS: ${emergency.latitude},${emergency.longitude}`
  };

  tier1ResponderIds.forEach(rId => {
    io.to(`room:user:${rId}`).emit('NEW_EMERGENCY_ALERT', alertPayload);
  });
  io.to('room:admin').emit('NEW_EMERGENCY_ALERT', alertPayload);

  io.to(`room:user:${emergency.userId}`).emit('SOS_STATUS_UPDATE', {
    status: 'PENDING_LOCAL',
    emergency,
    googleMapsUrl,
    message: 'SOS Alert active! Alerting your linked neighbors and security guards...'
  });

  // Start 60-second escalation countdown
  const timerId = setTimeout(async () => {
    try {
      let currentAlert;
      if (isDbConnected()) {
        currentAlert = await Emergency.findById(emergency._id);
      } else {
        currentAlert = memoryStore.emergencies.find(e => e._id.toString() === emergency._id.toString());
      }

      if (currentAlert && currentAlert.status === 'PENDING_LOCAL') {
        console.log(`[Escalation Timer Fired] Alert ID ${emergency.alertId} timed out after 60s without acceptance. Escalating to linked Family Members & Volunteers!`);

        currentAlert.status = 'ESCALATED_VOLUNTEER';
        currentAlert.tier2Notified = true;
        currentAlert.escalatedAt = new Date();

        if (isDbConnected()) {
          await currentAlert.save();
        }

        const alertObj = currentAlert.toObject ? currentAlert.toObject() : { ...currentAlert };
        alertObj.googleMapsUrl = googleMapsUrl;

        // Tier 2: Escalated to linked Family Members and Volunteers (plus re-notify Tier 1)
        const tier2ResponderIds = await getLinkedResponderUserIds(emergency.userId, ['family_member', 'volunteer']);
        const allLinkedResponderIds = Array.from(new Set([...tier1ResponderIds, ...tier2ResponderIds]));

        console.log(`[Tier 2 SOS Escalated] Notifying ${allLinkedResponderIds.length} linked responders (Family/Volunteers).`);

        const escalatedPayload = {
          tier: 2,
          emergency: alertObj,
          googleMapsUrl,
          message: `⚠️ ESCALATED EMERGENCY! No response within 60s for ${currentAlert.userName}. Location: ${googleMapsUrl}`
        };

        allLinkedResponderIds.forEach(rId => {
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

