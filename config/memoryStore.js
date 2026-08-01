/* SafeReach - High Performance In-Memory Data Store Fallback */

const bcrypt = require('bcryptjs');

const users = [];
const emergencies = [];
const neighbors = [];
const securityGuards = [];
const volunteers = [];
const emergencyContacts = [];
const linkRequests = [];

// Populate default demo data instantly into memory store
const initSeedData = async () => {
  if (users.length > 0) return;

  const passwordHash = await bcrypt.hash('password123', 10);

  const senior = {
    _id: 'usr_senior_001',
    name: 'Eleanor Vance (Senior)',
    email: 'senior@safereach.com',
    phone: '+1 (555) 234-5678',
    password: passwordHash,
    role: 'senior_citizen',
    address: 'Apartment 4B, Sunrise Heights Block A',
    apartmentNumber: 'A-4B',
    latitude: 12.9716,
    longitude: 77.5946,
    medicalInfo: 'Hypertension, Cardiac Pacemaker',
    active: true,
    createdAt: new Date()
  };

  const child = {
    _id: 'usr_child_002',
    name: 'Tommy Miller (Child)',
    email: 'child@safereach.com',
    phone: '+1 (555) 876-5432',
    password: passwordHash,
    role: 'child',
    address: 'Apartment 2A, Sunrise Heights Block A',
    apartmentNumber: 'A-2A',
    latitude: 12.9720,
    longitude: 77.5950,
    medicalInfo: 'Asthma Inhaler in Backpack',
    active: true,
    createdAt: new Date()
  };

  const family = {
    _id: 'usr_family_003',
    name: 'Robert Vance (Family)',
    email: 'family@safereach.com',
    phone: '+1 (555) 999-1122',
    password: passwordHash,
    role: 'family_member',
    address: '102 Oakwood Drive, City West',
    apartmentNumber: 'House 102',
    active: true,
    createdAt: new Date()
  };

  const neighborUser = {
    _id: 'usr_neighbor_004',
    name: 'Sarah Jenkins (Neighbor)',
    email: 'neighbor@safereach.com',
    phone: '+1 (555) 333-4455',
    password: passwordHash,
    role: 'neighbor',
    address: 'Apartment 4C, Sunrise Heights Block A',
    apartmentNumber: 'A-4C',
    latitude: 12.9717,
    longitude: 77.5948,
    active: true,
    createdAt: new Date()
  };

  const guardUser = {
    _id: 'usr_guard_005',
    name: 'Officer David Guard',
    email: 'guard@safereach.com',
    phone: '+1 (555) 444-5566',
    password: passwordHash,
    role: 'security_guard',
    address: 'Main Entrance Gatehouse, Sunrise Heights',
    apartmentNumber: 'Gate 1',
    dutyStatus: 'ON_DUTY',
    active: true,
    createdAt: new Date()
  };

  const volunteerUser = {
    _id: 'usr_volunteer_006',
    name: 'Marcus Swift (Community Volunteer)',
    email: 'volunteer@safereach.com',
    phone: '+1 (555) 777-8899',
    password: passwordHash,
    role: 'volunteer',
    address: 'Community Center, Block C',
    apartmentNumber: 'C-01',
    availability: 'AVAILABLE',
    active: true,
    createdAt: new Date()
  };

  const adminUser = {
    _id: 'usr_admin_007',
    name: 'System Admin',
    email: 'admin@safereach.com',
    phone: '+1 (555) 000-1111',
    password: passwordHash,
    role: 'admin',
    address: 'SafeReach Operations Command Center',
    active: true,
    createdAt: new Date()
  };

  users.push(senior, child, family, neighborUser, guardUser, volunteerUser, adminUser);

  neighbors.push({
    _id: 'ngh_001',
    userId: neighborUser._id,
    name: neighborUser.name,
    phone: neighborUser.phone,
    address: neighborUser.address,
    apartmentNumber: neighborUser.apartmentNumber
  });

  securityGuards.push({
    _id: 'grd_001',
    userId: guardUser._id,
    name: guardUser.name,
    phone: guardUser.phone,
    apartment: 'Sunrise Heights Main Gate',
    dutyStatus: 'ON_DUTY'
  });

  volunteers.push({
    _id: 'vol_001',
    userId: volunteerUser._id,
    name: volunteerUser.name,
    phone: volunteerUser.phone,
    address: volunteerUser.address,
    availability: 'AVAILABLE'
  });

  emergencyContacts.push({
    _id: 'cnt_001',
    userId: senior._id,
    contactName: family.name,
    phone: family.phone,
    relationship: 'Son'
  });

  emergencies.push({
    _id: 'emg_sample_1',
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
      userId: guardUser._id,
      name: guardUser.name,
      phone: guardUser.phone,
      role: guardUser.role
    },
    acceptedAt: new Date(Date.now() - 86400000),
    responseTimeSeconds: 24,
    resolvedAt: new Date(Date.now() - 85000000),
    resolutionNotes: 'Security Guard reached apartment, assisted senior with medication.',
    createdAt: new Date(Date.now() - 86400000)
  });

  linkRequests.push(
    {
      _id: 'req_001',
      seniorUserId: senior._id,
      seniorName: senior.name,
      seniorAddress: senior.address,
      targetName: family.name,
      targetEmail: family.email,
      targetPhone: family.phone,
      targetRole: 'family_member',
      relationship: 'Son',
      responderUserId: family._id,
      status: 'PENDING',
      requestDate: 'Jul 26, 2026',
      createdAt: new Date()
    },
    {
      _id: 'req_002',
      seniorUserId: senior._id,
      seniorName: senior.name,
      seniorAddress: senior.address,
      targetName: neighborUser.name,
      targetEmail: neighborUser.email,
      targetPhone: neighborUser.phone,
      targetRole: 'neighbor',
      relationship: 'Nearby Apartment Neighbor',
      responderUserId: neighborUser._id,
      status: 'ACCEPTED',
      requestDate: 'Jul 25, 2026',
      createdAt: new Date()
    },
    {
      _id: 'req_003',
      seniorUserId: senior._id,
      seniorName: senior.name,
      seniorAddress: senior.address,
      targetName: guardUser.name,
      targetEmail: guardUser.email,
      targetPhone: guardUser.phone,
      targetRole: 'security_guard',
      relationship: 'Gatehouse Guard',
      responderUserId: guardUser._id,
      status: 'PENDING',
      requestDate: 'Jul 26, 2026',
      createdAt: new Date()
    },
    {
      _id: 'req_004',
      seniorUserId: senior._id,
      seniorName: senior.name,
      seniorAddress: senior.address,
      targetName: volunteerUser.name,
      targetEmail: volunteerUser.email,
      targetPhone: volunteerUser.phone,
      targetRole: 'volunteer',
      relationship: 'Community Responder',
      responderUserId: volunteerUser._id,
      status: 'REJECTED',
      requestDate: 'Jul 24, 2026',
      createdAt: new Date()
    }
  );

  console.log('[MemoryStore] In-memory database populated with sample demo users & link requests.');
};

initSeedData();

module.exports = {
  users,
  emergencies,
  neighbors,
  securityGuards,
  volunteers,
  emergencyContacts,
  linkRequests
};
