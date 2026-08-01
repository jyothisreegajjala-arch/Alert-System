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
// Auto-Seed Helper on Database Connection
// ----------------------------------------------------

const autoSeedDatabase = async () => {
  if (!isDbConnected()) return;
  try {
    const count = await User.countDocuments();
    if (count > 0) return;

    console.log('[Auto-Seed] Initializing demo users for all 7 roles in MongoDB...');

    const senior = await User.create({
      name: 'Eleanor Vance (Senior)',
      email: 'senior@safereach.com',
      phone: '+1 (555) 234-5678',
      password: 'password123',
      role: 'senior_citizen',
      address: 'Apartment 4B, Sunrise Heights Block A',
      apartmentNumber: 'A-4B',
      latitude: 12.9716,
      longitude: 77.5946,
      medicalInfo: 'Hypertension, Cardiac Pacemaker'
    });

    const child = await User.create({
      name: 'Tommy Miller (Child)',
      email: 'child@safereach.com',
      phone: '+1 (555) 876-5432',
      password: 'password123',
      role: 'child',
      address: 'Apartment 2A, Sunrise Heights Block A',
      apartmentNumber: 'A-2A',
      latitude: 12.9720,
      longitude: 77.5950,
      medicalInfo: 'Asthma Inhaler in Backpack'
    });

    const family = await User.create({
      name: 'Robert Vance (Family)',
      email: 'family@safereach.com',
      phone: '+1 (555) 999-1122',
      password: 'password123',
      role: 'family_member',
      address: '102 Oakwood Drive, City West',
      apartmentNumber: 'House 102'
    });

    const neighbor = await User.create({
      name: 'Sarah Jenkins (Neighbor)',
      email: 'neighbor@safereach.com',
      phone: '+1 (555) 333-4455',
      password: 'password123',
      role: 'neighbor',
      address: 'Apartment 4C, Sunrise Heights Block A',
      apartmentNumber: 'A-4C',
      latitude: 12.9717,
      longitude: 77.5948
    });

    await Neighbor.create({
      userId: neighbor._id,
      name: neighbor.name,
      phone: neighbor.phone,
      address: neighbor.address,
      apartmentNumber: neighbor.apartmentNumber
    });

    const guard = await User.create({
      name: 'Officer David Guard',
      email: 'guard@safereach.com',
      phone: '+1 (555) 444-5566',
      password: 'password123',
      role: 'security_guard',
      address: 'Main Entrance Gatehouse, Sunrise Heights',
      apartmentNumber: 'Gate 1',
      dutyStatus: 'ON_DUTY'
    });

    await SecurityGuard.create({
      userId: guard._id,
      name: guard.name,
      phone: guard.phone,
      apartment: 'Sunrise Heights Main Gate',
      dutyStatus: 'ON_DUTY'
    });

    const volunteer = await User.create({
      name: 'Marcus Swift (Community Volunteer)',
      email: 'volunteer@safereach.com',
      phone: '+1 (555) 777-8899',
      password: 'password123',
      role: 'volunteer',
      address: 'Community Center, Block C',
      apartmentNumber: 'C-01',
      availability: 'AVAILABLE'
    });

    await Volunteer.create({
      userId: volunteer._id,
      name: volunteer.name,
      phone: volunteer.phone,
      address: volunteer.address,
      availability: 'AVAILABLE'
    });

    await User.create({
      name: 'System Admin',
      email: 'admin@safereach.com',
      phone: '+1 (555) 000-1111',
      password: 'password123',
      role: 'admin',
      address: 'SafeReach Operations Command Center'
    });

    await EmergencyContact.create({
      userId: senior._id,
      contactName: family.name,
      phone: family.phone,
      relationship: 'Son',
      familyUserId: family._id
    });

    await Emergency.create({
      alertId: 'SR-102938',
      userId: senior._id,
      userName: senior.name,
      userPhone: senior.phone,
      userRole: senior.role,
      address: senior.address,
      latitude: senior.latitude,
      longitude: senior.longitude,
      date: 'Jul 24, 2026',
      time: '14:20:00',
      emergencyType: 'Medical Assistance Required',
      medicalInfo: senior.medicalInfo,
      status: 'RESOLVED',
      tier1Notified: true,
      tier2Notified: false,
      acceptedBy: {
        userId: guard._id,
        name: guard.name,
        phone: guard.phone,
        role: guard.role
      },
      acceptedAt: new Date(Date.now() - 86400000),
      responseTimeSeconds: 24,
      resolvedAt: new Date(Date.now() - 85000000),
      resolutionNotes: 'Security Guard reached apartment, assisted senior with medication.'
    });

    console.log('[Auto-Seed] Pre-populated all 7 demo user accounts in MongoDB.');
  } catch (err) {
    console.error('[Auto-Seed Error]:', err.message);
  }
};

// ----------------------------------------------------
// 60-Second Real-Time Escalation Engine & Socket.IO
// ----------------------------------------------------

const activeEscalationTimers = new Map();

const handleSOSTrigger = async (emergency) => {
  console.log(`[SOS Triggered] Alert ID: ${emergency.alertId} by ${emergency.userName}`);

  const googleMapsUrl = `https://www.google.com/maps?q=${emergency.latitude},${emergency.longitude}`;
  emergency.googleMapsUrl = googleMapsUrl;

  io.to('room:neighbors').to('room:security_guard').emit('NEW_EMERGENCY_ALERT', {
    tier: 1,
    emergency,
    googleMapsUrl,
    countdownSeconds: 60,
    message: `🚨 URGENT SOS ALERT from ${emergency.userName} (${emergency.address})! GPS: ${emergency.latitude},${emergency.longitude} Maps: ${googleMapsUrl}`
  });

  io.to(`room:user:${emergency.userId}`).emit('SOS_STATUS_UPDATE', {
    status: 'PENDING_LOCAL',
    emergency,
    googleMapsUrl,
    message: 'SOS Alert active! Alerting nearby neighbors and security guards with your live location...'
  });

  const timerId = setTimeout(async () => {
    try {
      let currentAlert;
      if (isDbConnected()) {
        currentAlert = await Emergency.findById(emergency._id);
      } else {
        currentAlert = memoryStore.emergencies.find(e => e._id.toString() === emergency._id.toString());
      }

      if (currentAlert && currentAlert.status === 'PENDING_LOCAL') {
        console.log(`[Escalation Timer Fired] Alert ID ${emergency.alertId} timed out after 60s without acceptance. Escalating to Volunteers & Family!`);

        currentAlert.status = 'ESCALATED_VOLUNTEER';
        currentAlert.tier2Notified = true;
        currentAlert.escalatedAt = new Date();

        if (isDbConnected()) {
          await currentAlert.save();
        }

        const alertObj = currentAlert.toObject ? currentAlert.toObject() : { ...currentAlert };
        alertObj.googleMapsUrl = googleMapsUrl;

        io.to('room:volunteer').to('room:family_member').to('room:neighbors').to('room:security_guard').emit('EMERGENCY_ESCALATED', {
          tier: 2,
          emergency: alertObj,
          googleMapsUrl,
          message: `⚠️ ESCALATED EMERGENCY! No local response within 60s for ${currentAlert.userName}. Location: ${googleMapsUrl}`
        });

        io.to(`room:user:${emergency.userId}`).emit('SOS_STATUS_UPDATE', {
          status: 'ESCALATED_VOLUNTEER',
          emergency: alertObj,
          googleMapsUrl,
          message: '60 seconds elapsed. Alert automatically escalated to registered Volunteers and Family Members!'
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

  // Notify Senior Citizen directly
  io.to(`room:user:${emergency.userId}`).emit('SOS_ACCEPTED_BY_HELPER', updatePayload);
  io.to('room:family_member').to(`room:user:${emergency.userId}`).emit('EMERGENCY_ACCEPTED', updatePayload);

  // Broadcast HELPER_ASSIGNED to all other responders
  io.emit('HELPER_ASSIGNED', {
    alertId: emergency.alertId,
    emergencyId: emergency._id,
    helperName: emergency.acceptedBy.name,
    helperRole: emergency.acceptedBy.role,
    message: `Helper Assigned: Emergency accepted by ${emergency.acceptedBy.name} (${emergency.acceptedBy.role})`
  });

  io.emit('EMERGENCY_STATUS_CHANGED', { emergency });
};

const handleSOSResolve = async (emergency) => {
  console.log(`[SOS Resolved] Alert ID ${emergency.alertId}`);
  if (activeEscalationTimers.has(emergency.alertId)) {
    clearTimeout(activeEscalationTimers.get(emergency.alertId));
    activeEscalationTimers.delete(emergency.alertId);
  }
  io.emit('EMERGENCY_RESOLVED', { emergency, message: `Emergency ${emergency.alertId} has been marked as RESOLVED.` });
};

const handleSOSCancel = async (emergency) => {
  if (activeEscalationTimers.has(emergency.alertId)) {
    clearTimeout(activeEscalationTimers.get(emergency.alertId));
    activeEscalationTimers.delete(emergency.alertId);
  }
  io.emit('EMERGENCY_CANCELLED', { emergency });
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
      if (connected) {
        autoSeedDatabase();
      } else {
        console.log('[Server] Operating with Memory Store fallback until MONGO_URI is configured in .env');
      }
    });
  });
}

module.exports = app;

