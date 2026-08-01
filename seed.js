const connectDB = require('./config/db');
const User = require('./models/User');
const Neighbor = require('./models/Neighbor');
const SecurityGuard = require('./models/SecurityGuard');
const Volunteer = require('./models/Volunteer');
const EmergencyContact = require('./models/EmergencyContact');
const Emergency = require('./models/Emergency');

const seedData = async () => {
  try {
    const isConnected = await connectDB();
    if (!isConnected) {
      console.log('[Seed] Could not connect to MongoDB Atlas. Please check MONGO_URI in your .env file.');
      process.exit(1);
    }

    console.log('[Seed] Refreshing demo accounts while preserving custom user accounts...');
    const demoEmails = ['senior@safereach.com', 'child@safereach.com', 'family@safereach.com', 'neighbor@safereach.com', 'guard@safereach.com', 'volunteer@safereach.com', 'admin@safereach.com'];
    await User.deleteMany({ email: { $in: demoEmails } });
    await Neighbor.deleteMany({});
    await SecurityGuard.deleteMany({});
    await Volunteer.deleteMany({});
    await EmergencyContact.deleteMany({});
    await Emergency.deleteMany({});

    console.log('[Seed] Creating demo users for all 7 roles...');

    // 1. Senior Citizen
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

    // 2. Child
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

    // 3. Family Member
    const family = await User.create({
      name: 'Robert Vance (Family)',
      email: 'family@safereach.com',
      phone: '+1 (555) 999-1122',
      password: 'password123',
      role: 'family_member',
      address: '102 Oakwood Drive, City West',
      apartmentNumber: 'House 102'
    });

    // 4. Neighbor
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

    // 5. Security Guard
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

    // 6. Volunteer
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

    // 7. Admin
    await User.create({
      name: 'System Admin',
      email: 'admin@safereach.com',
      phone: '+1 (555) 000-1111',
      password: 'password123',
      role: 'admin',
      address: 'SafeReach Operations Command Center'
    });

    // Link Emergency Contacts
    await EmergencyContact.create({
      userId: senior._id,
      contactName: family.name,
      phone: family.phone,
      relationship: 'Son',
      familyUserId: family._id
    });

    // Create a sample past emergency record for history display
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

    console.log('[Seed] Demo data successfully populated!');
    console.log('--------------------------------------------------');
    console.log('Demo Credentials for Testing:');
    console.log('Senior Citizen: senior@safereach.com / password123');
    console.log('Child:          child@safereach.com / password123');
    console.log('Family Member:  family@safereach.com / password123');
    console.log('Neighbor:       neighbor@safereach.com / password123');
    console.log('Security Guard: guard@safereach.com / password123');
    console.log('Volunteer:      volunteer@safereach.com / password123');
    console.log('Admin:          admin@safereach.com / password123');
    console.log('--------------------------------------------------');

    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
};

seedData();
