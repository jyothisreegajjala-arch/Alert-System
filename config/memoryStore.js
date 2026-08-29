/* SafeReach - In-Memory Real-Time Community Data Store */

const users = [
  // 1. Senior Citizens
  {
    _id: 'user_sr_1',
    id: 'user_sr_1',
    name: 'Gajjala Jyothi Sree',
    email: 'jyothisree@example.com',
    phone: '9398423743',
    role: 'senior_citizen',
    address: 'Nandyala road, Flat A-101',
    apartmentNumber: 'Flat A-101',
    medicalInfo: 'Hypertension, Cardiac Pacemaker',
    latitude: 15.774179,
    longitude: 78.055417,
    createdAt: new Date('2026-08-01T08:00:00Z')
  },
  {
    _id: 'user_sr_2',
    id: 'user_sr_2',
    name: 'Ramesh Chandra',
    email: 'ramesh.chandra@example.com',
    phone: '9876543201',
    role: 'senior_citizen',
    address: 'Block B, Flat 204',
    apartmentNumber: 'Flat B-204',
    medicalInfo: 'Diabetic Type 2, Blood Pressure',
    latitude: 15.775100,
    longitude: 78.056300,
    createdAt: new Date('2026-08-05T09:30:00Z')
  },
  {
    _id: 'user_sr_3',
    id: 'user_sr_3',
    name: 'Sita Devi',
    email: 'sita.devi@example.com',
    phone: '9876543202',
    role: 'senior_citizen',
    address: 'Block A, Flat 105',
    apartmentNumber: 'Flat A-105',
    medicalInfo: 'Arthritis, Mobility Support Required',
    latitude: 15.773900,
    longitude: 78.054900,
    createdAt: new Date('2026-08-08T10:15:00Z')
  },
  {
    _id: 'user_sr_4',
    id: 'user_sr_4',
    name: 'Subba Rao',
    email: 'subbarao@example.com',
    phone: '9876543203',
    role: 'senior_citizen',
    address: 'Block C, Flat 301',
    apartmentNumber: 'Flat C-301',
    medicalInfo: 'Cardiac Bypass History',
    latitude: 15.776200,
    longitude: 78.057100,
    createdAt: new Date('2026-08-12T14:20:00Z')
  },

  // 2. Children / Dependents
  {
    _id: 'user_ch_1',
    id: 'user_ch_1',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    phone: '9876543210',
    role: 'child',
    address: 'Block C-302, Green Meadows',
    apartmentNumber: 'Flat C-302',
    medicalInfo: 'Asthma inhaler in bag',
    latitude: 15.776500,
    longitude: 78.058200,
    createdAt: new Date('2026-08-10T11:00:00Z')
  },
  {
    _id: 'user_ch_2',
    id: 'user_ch_2',
    name: 'Ananya Rao',
    email: 'ananya.rao@example.com',
    phone: '9876543215',
    role: 'child',
    address: 'Block A-202',
    apartmentNumber: 'Flat A-202',
    medicalInfo: 'Severe Peanut Allergy',
    latitude: 15.774500,
    longitude: 78.055800,
    createdAt: new Date('2026-08-15T12:00:00Z')
  },

  // 3. Family Members / Guardians
  {
    _id: 'user_fm_1',
    id: 'user_fm_1',
    name: 'Ankit Kumar',
    email: 'ankit.kumar@example.com',
    phone: '9876543210',
    role: 'family_member',
    address: 'Block B, Flat 201',
    apartmentNumber: 'Flat B-201',
    familyRelationship: 'Father / Guardian',
    latitude: 15.774800,
    longitude: 78.056000,
    createdAt: new Date('2026-08-01T08:30:00Z')
  },
  {
    _id: 'user_fm_2',
    id: 'user_fm_2',
    name: 'Gajjala PullaReddy',
    email: 'pullareddy.gajjala@gmail.com',
    phone: '9296007779',
    role: 'family_member',
    address: 'Nandyala road',
    apartmentNumber: 'Flat A-101',
    familyRelationship: 'Son / Primary Guardian',
    latitude: 15.774179,
    longitude: 78.055417,
    createdAt: new Date('2026-08-01T09:00:00Z')
  },
  {
    _id: 'user_fm_3',
    id: 'user_fm_3',
    name: 'Pooja Sharma',
    email: 'pooja.sharma@example.com',
    phone: '9876543211',
    role: 'family_member',
    address: 'Block C-302',
    apartmentNumber: 'Flat C-302',
    familyRelationship: 'Mother / Guardian',
    latitude: 15.776500,
    longitude: 78.058200,
    createdAt: new Date('2026-08-02T10:00:00Z')
  },
  {
    _id: 'user_fm_4',
    id: 'user_fm_4',
    name: 'Jahnavi Reddy',
    email: 'jahnavi.reddy@gmail.com',
    phone: '9848054321',
    role: 'family_member',
    address: 'Nandyala road',
    apartmentNumber: 'Flat A-101',
    familyRelationship: 'Family Guardian',
    latitude: 15.774179,
    longitude: 78.055417,
    createdAt: new Date('2026-08-02T11:00:00Z')
  },

  // 4. Nearby Neighbors
  {
    _id: 'user_nb_1',
    id: 'user_nb_1',
    name: 'Shalini',
    email: 'shalinimarisetty16@gmail.com',
    phone: '9398423743',
    role: 'neighbor',
    address: 'Block A, Flat 102 (Same Floor)',
    apartmentNumber: 'Flat A-102',
    latitude: 15.774200,
    longitude: 78.055500,
    createdAt: new Date('2026-08-03T09:00:00Z')
  },
  {
    _id: 'user_nb_2',
    id: 'user_nb_2',
    name: 'Priya Patel',
    email: 'priya.patel@example.com',
    phone: '9876543220',
    role: 'neighbor',
    address: 'Block A, Flat 103',
    apartmentNumber: 'Flat A-103',
    latitude: 15.774250,
    longitude: 78.055600,
    createdAt: new Date('2026-08-04T10:00:00Z')
  },
  {
    _id: 'user_nb_3',
    id: 'user_nb_3',
    name: 'Suresh Nair',
    email: 'suresh.nair@example.com',
    phone: '9876543221',
    role: 'neighbor',
    address: 'Block B, Flat 203',
    apartmentNumber: 'Flat B-203',
    latitude: 15.774900,
    longitude: 78.056100,
    createdAt: new Date('2026-08-05T11:30:00Z')
  },

  // 5. Security Guards
  {
    _id: 'user_sec_1',
    id: 'user_sec_1',
    name: 'Security Guard Vikram',
    email: 'guard.vikram@example.com',
    phone: '9876543230',
    role: 'security_guard',
    address: 'Main Gate 1 Security Station',
    apartmentNumber: 'Gate 1 Booth',
    dutyStatus: 'ON_DUTY',
    latitude: 15.773500,
    longitude: 78.054500,
    createdAt: new Date('2026-08-01T06:00:00Z')
  },
  {
    _id: 'user_sec_2',
    id: 'user_sec_2',
    name: 'Security Guard Ramesh',
    email: 'guard.ramesh@example.com',
    phone: '9876543231',
    role: 'security_guard',
    address: 'Tower B Security Station',
    apartmentNumber: 'Gate 2 Booth',
    dutyStatus: 'ON_DUTY',
    latitude: 15.775500,
    longitude: 78.056800,
    createdAt: new Date('2026-08-01T06:00:00Z')
  },

  // 6. Community Volunteers
  {
    _id: 'user_vol_1',
    id: 'user_vol_1',
    name: 'Karthik V',
    email: 'karthik.v@example.com',
    phone: '9876543240',
    role: 'volunteer',
    address: 'Block B Volunteer Hub',
    apartmentNumber: 'Community Hub B',
    medicalInfo: 'First Aid Certified, CPR Trained',
    availability: 'AVAILABLE',
    latitude: 15.775000,
    longitude: 78.056200,
    createdAt: new Date('2026-08-02T08:00:00Z')
  },
  {
    _id: 'user_vol_2',
    id: 'user_vol_2',
    name: 'Deepa Nair',
    email: 'deepa.nair@example.com',
    phone: '9876543241',
    role: 'volunteer',
    address: 'Block A Volunteer Hub',
    apartmentNumber: 'Community Hub A',
    medicalInfo: 'Red Cross Certified First Responder, Nurse',
    availability: 'AVAILABLE',
    latitude: 15.774000,
    longitude: 78.055200,
    createdAt: new Date('2026-08-03T08:30:00Z')
  },

  // 7. System Administrator
  {
    _id: 'user_adm_1',
    id: 'user_adm_1',
    name: 'tarun tej',
    email: 'admin@safereach.com',
    phone: '9390816692',
    role: 'admin',
    address: 'CareConnect Central Command Center',
    apartmentNumber: 'Command HQ',
    location: 'tamilnadu',
    latitude: 15.774179,
    longitude: 78.055417,
    createdAt: new Date('2026-08-01T00:00:00Z')
  }
];

const emergencies = [
  // 1. Active Senior SOS Alert
  {
    _id: 'emg_sr_510459',
    alertId: 'SR-510459',
    userId: 'user_sr_1',
    userName: 'Gajjala Jyothi Sree',
    userRole: 'senior_citizen',
    userPhone: '9398423743',
    address: 'Nandyala road, Flat A-101',
    latitude: 15.774179,
    longitude: 78.055417,
    emergencyType: 'Critical SOS Emergency',
    medicalInfo: 'Hypertension, Cardiac Pacemaker',
    status: 'PENDING_LOCAL',
    date: 'Aug 29, 2026',
    time: '10:45:00 AM',
    createdAt: new Date()
  },
  // 2. Active Child SOS Alert
  {
    _id: 'emg_ch_782104',
    alertId: 'CH-782104',
    userId: 'user_ch_1',
    userName: 'Aarav Sharma',
    userRole: 'child',
    userPhone: '9876543210',
    address: 'Green Meadows School / Gate 2',
    latitude: 15.776500,
    longitude: 78.058200,
    emergencyType: 'Child Assistance SOS',
    medicalInfo: 'Asthma inhaler in bag',
    status: 'ACCEPTED',
    acceptedBy: { userId: 'user_fm_1', name: 'Ankit Kumar', role: 'family_member', phone: '9876543210' },
    date: 'Aug 29, 2026',
    time: '10:30:00 AM',
    createdAt: new Date(Date.now() - 900000)
  },
  // 3. Resolved Senior Alert
  {
    _id: 'emg_sr_492108',
    alertId: 'SR-492108',
    userId: 'user_sr_1',
    userName: 'Gajjala Jyothi Sree',
    userRole: 'senior_citizen',
    userPhone: '9398423743',
    address: 'Nandyala road, Block A',
    latitude: 15.774179,
    longitude: 78.055417,
    emergencyType: 'Medical Assistance / SOS',
    medicalInfo: 'Hypertension, Cardiac Pacemaker',
    status: 'RESOLVED',
    acceptedBy: { userId: 'user_nb_1', name: 'Shalini', role: 'neighbor', phone: '9398423743' },
    responseTimeSeconds: 65,
    date: 'Aug 20, 2026',
    time: '11:35:00 AM',
    createdAt: new Date('2026-08-20T11:35:00Z')
  },
  // 4. Resolved Senior Alert 2
  {
    _id: 'emg_sr_481920',
    alertId: 'SR-481920',
    userId: 'user_sr_1',
    userName: 'Gajjala Jyothi Sree',
    userRole: 'senior_citizen',
    userPhone: '9398423743',
    address: 'Nandyala road, Flat A-101',
    latitude: 15.774179,
    longitude: 78.055417,
    emergencyType: 'SOS Emergency',
    medicalInfo: 'Hypertension, Cardiac Pacemaker',
    status: 'RESOLVED',
    acceptedBy: { userId: 'user_fm_4', name: 'Jahnavi Reddy', role: 'family_member', phone: '9848054321' },
    responseTimeSeconds: 38,
    date: 'Aug 14, 2026',
    time: '09:18:00 AM',
    createdAt: new Date('2026-08-14T09:18:00Z')
  },
  // 5. Resolved Cardiac Distress
  {
    _id: 'emg_sr_470211',
    alertId: 'SR-470211',
    userId: 'user_sr_2',
    userName: 'Ramesh Chandra',
    userRole: 'senior_citizen',
    userPhone: '9876543201',
    address: 'Block B, Flat 204',
    latitude: 15.775100,
    longitude: 78.056300,
    emergencyType: 'Cardiac Distress',
    medicalInfo: 'Diabetic Type 2, Blood Pressure',
    status: 'RESOLVED',
    acceptedBy: { userId: 'user_sec_1', name: 'Security Guard Vikram', role: 'security_guard', phone: '9876543230' },
    responseTimeSeconds: 52,
    date: 'Aug 05, 2026',
    time: '02:40:00 PM',
    createdAt: new Date('2026-08-05T14:40:00Z')
  },
  // 6. Resolved Fall Emergency
  {
    _id: 'emg_sr_460199',
    alertId: 'SR-460199',
    userId: 'user_sr_3',
    userName: 'Sita Devi',
    userRole: 'senior_citizen',
    userPhone: '9876543202',
    address: 'Block A, Flat 105',
    latitude: 15.773900,
    longitude: 78.054900,
    emergencyType: 'Mobility Slip & Fall',
    medicalInfo: 'Arthritis, Mobility Support Required',
    status: 'RESOLVED',
    acceptedBy: { userId: 'user_vol_1', name: 'Karthik V', role: 'volunteer', phone: '9876543240' },
    responseTimeSeconds: 45,
    date: 'Aug 02, 2026',
    time: '04:15:00 PM',
    createdAt: new Date('2026-08-02T16:15:00Z')
  }
];

const neighbors = users.filter(u => u.role === 'neighbor');
const securityGuards = users.filter(u => u.role === 'security_guard');
const volunteers = users.filter(u => u.role === 'volunteer');
const emergencyContacts = users.filter(u => u.role === 'family_member');

const linkRequests = [
  {
    _id: 'lr_1',
    seniorUserId: 'user_sr_1',
    seniorName: 'Gajjala Jyothi Sree',
    seniorPhone: '9398423743',
    seniorAddress: 'Nandyala road, Flat A-101',
    targetName: 'Gajjala PullaReddy',
    targetRole: 'family_member',
    relationship: 'Son / Primary Guardian',
    targetEmail: 'pullareddy.gajjala@gmail.com',
    targetPhone: '9296007779',
    status: 'ACCEPTED',
    createdAt: new Date('2026-08-01T09:00:00Z')
  },
  {
    _id: 'lr_2',
    seniorUserId: 'user_sr_1',
    seniorName: 'Gajjala Jyothi Sree',
    seniorPhone: '9398423743',
    seniorAddress: 'Nandyala road, Flat A-101',
    targetName: 'Shalini',
    targetRole: 'neighbor',
    relationship: 'Nearby Apartment',
    targetEmail: 'shalinimarisetty16@gmail.com',
    targetPhone: '9398423743',
    status: 'ACCEPTED',
    createdAt: new Date('2026-08-03T09:00:00Z')
  },
  {
    _id: 'lr_3',
    seniorUserId: 'user_sr_1',
    seniorName: 'Gajjala Jyothi Sree',
    seniorPhone: '9398423743',
    seniorAddress: 'Nandyala road, Flat A-101',
    targetName: 'Jahnavi Reddy',
    targetRole: 'family_member',
    relationship: 'Family Guardian',
    targetEmail: 'jahnavi.reddy@gmail.com',
    targetPhone: '9848054321',
    status: 'ACCEPTED',
    createdAt: new Date('2026-08-02T11:00:00Z')
  },
  {
    _id: 'lr_4',
    seniorUserId: 'user_ch_1',
    seniorName: 'Aarav Sharma',
    seniorPhone: '9876543210',
    seniorAddress: 'Block C-302, Green Meadows',
    targetName: 'Ankit Kumar',
    targetRole: 'family_member',
    relationship: 'Father / Primary Guardian',
    targetEmail: 'ankit.kumar@example.com',
    targetPhone: '9876543210',
    status: 'ACCEPTED',
    createdAt: new Date('2026-08-10T11:00:00Z')
  }
];

const notifications = [
  {
    _id: 'notif_adm_1',
    title: '🚨 CRITICAL SOS ALERT: #SR-510459',
    message: 'Active emergency triggered by Gajjala Jyothi Sree at Nandyala road, Flat A-101. Responders in 60s window.',
    senderName: 'Gajjala Jyothi Sree',
    senderRole: 'Senior Citizen',
    emergencyType: 'Critical SOS Emergency',
    address: 'Nandyala road, Flat A-101',
    status: 'PENDING',
    createdAt: new Date()
  },
  {
    _id: 'notif_adm_2',
    title: '✅ Responder Assigned: #CH-782104',
    message: 'Ankit Kumar accepted emergency dispatch for Aarav Sharma at Green Meadows School.',
    senderName: 'Ankit Kumar',
    senderRole: 'Guardian / Father',
    emergencyType: 'Child Assistance SOS',
    address: 'Green Meadows School / Gate 2',
    status: 'ACCEPTED',
    createdAt: new Date(Date.now() - 900000)
  },
  {
    _id: 'notif_adm_3',
    title: '🏁 Incident Resolved: #SR-492108',
    message: 'Emergency #SR-492108 for Gajjala Jyothi Sree resolved by Shalini in 65s.',
    senderName: 'CareConnect Dispatch',
    senderRole: 'System Dispatch',
    emergencyType: 'SOS Alert Resolution',
    address: 'Nandyala road, Block A',
    status: 'READ',
    createdAt: new Date('2026-08-20T11:35:00Z')
  }
];

module.exports = {
  users,
  emergencies,
  neighbors,
  securityGuards,
  volunteers,
  emergencyContacts,
  linkRequests,
  notifications
};

