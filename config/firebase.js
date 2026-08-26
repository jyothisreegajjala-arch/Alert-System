const admin = require('firebase-admin');
const User = require('../models/User');
const mongoose = require('mongoose');

let firebaseApp = null;
let isFirebaseInitialized = false;

function initFirebase() {
  if (firebaseApp) return true;

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
      const credentials = JSON.parse(serviceAccountJson);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(credentials)
      });
      isFirebaseInitialized = true;
      console.log('[FCM Backend] Firebase Admin SDK initialized using SERVICE_ACCOUNT_JSON.');
      return true;
    } else if (projectId && clientEmail && privateKey) {
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      isFirebaseInitialized = true;
      console.log('[FCM Backend] Firebase Admin SDK initialized using Environment Variables.');
      return true;
    } else {
      console.warn('[FCM Backend Warning] Firebase credentials missing (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY). Push notifications will operate in simulation mode until credentials are provided in .env');
      return false;
    }
  } catch (err) {
    console.error('[FCM Backend Initialization Error]:', err.message);
    return false;
  }
}

/**
 * Send FCM Push Notification to targeted user IDs
 * @param {Array<string>} userIds - Target User MongoDB ObjectIDs or strings
 * @param {Object} notificationPayload - { title, body }
 * @param {Object} dataPayload - Key-value pair strings for deep-linking
 */
async function sendFCMPushNotification(userIds, notificationPayload, dataPayload = {}) {
  if (!userIds || userIds.length === 0) return { success: false, sentCount: 0 };

  const initialized = initFirebase();

  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    let tokens = [];

    if (isDbConnected) {
      const users = await User.find({
        _id: { $in: userIds },
        'fcmTokens.0': { $exists: true }
      }).select('_id fcmTokens');

      for (const u of users) {
        if (u.fcmTokens && u.fcmTokens.length > 0) {
          u.fcmTokens.forEach(t => {
            if (t.token) tokens.push({ userId: u._id, token: t.token });
          });
        }
      }
    } else {
      const memoryStore = require('./memoryStore');
      const userIdStrs = userIds.map(id => id.toString());
      (memoryStore.users || []).forEach(u => {
        if (userIdStrs.includes(u._id.toString()) && u.fcmTokens) {
          u.fcmTokens.forEach(t => {
            if (t.token) tokens.push({ userId: u._id, token: t.token });
          });
        }
      });
    }

    if (tokens.length === 0) {
      console.log('[FCM Push] No registered FCM device tokens found for recipient user IDs.');
      return { success: true, sentCount: 0 };
    }

    const rawTokens = Array.from(new Set(tokens.map(t => t.token)));
    console.log(`[FCM Push] Dispatching notification to ${rawTokens.length} device tokens...`);

    if (!initialized) {
      console.log(`[FCM Push Simulated] Title: "${notificationPayload.title}", Body: "${notificationPayload.body}"`);
      return { success: true, sentCount: rawTokens.length, simulated: true };
    }

    // Standard string payload formatting for FCM data
    const formattedData = {};
    Object.keys(dataPayload).forEach(key => {
      formattedData[key] = String(dataPayload[key]);
    });

    const message = {
      notification: {
        title: notificationPayload.title || '🚨 SafeReach Alert',
        body: notificationPayload.body || 'Emergency alert triggered.'
      },
      data: formattedData,
      tokens: rawTokens,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'safereach_emergency_channel',
          priority: 'high',
          visibility: 'public'
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM Push Success] ${response.successCount} sent, ${response.failureCount} failed.`);

    // Requirement 15: Clean up invalid or stale tokens
    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error ? resp.error.code : '';
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(rawTokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        console.log(`[FCM Token Cleanup] Removing ${invalidTokens.length} unregistered device tokens...`);
        if (isDbConnected) {
          await User.updateMany(
            { 'fcmTokens.token': { $in: invalidTokens } },
            { $pull: { fcmTokens: { token: { $in: invalidTokens } } } }
          );
        } else {
          const memoryStore = require('./memoryStore');
          (memoryStore.users || []).forEach(u => {
            if (u.fcmTokens) {
              u.fcmTokens = u.fcmTokens.filter(t => !invalidTokens.includes(t.token));
            }
          });
        }
      }
    }

    return { success: true, sentCount: response.successCount };
  } catch (err) {
    console.error('[FCM Push Dispatch Error]:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  initFirebase,
  sendFCMPushNotification
};
