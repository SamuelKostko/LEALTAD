import { getFirestoreDb } from '../_lib/firestore.js';
import { sendJson } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { normalizeEmail } from '../_lib/utils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!(await requireAdmin(req, res))) return;

  const firestore = getFirestoreDb();
  const configDocRef = firestore.collection('config').doc('reports_settings');

  try {
    if (req.method === 'GET') {
      const doc = await configDocRef.get();
      if (!doc.exists) {
        sendJson(res, 200, {
          ok: true,
          emails: '',
          scheduleEnabled: false,
          scheduleTime: '18:00',
          schedulePeriod: 'day'
        });
        return;
      }
      const data = doc.data() || {};
      sendJson(res, 200, {
        ok: true,
        emails: data.emails ?? '',
        scheduleEnabled: !!data.scheduleEnabled,
        scheduleTime: typeof data.scheduleTime === 'string' ? data.scheduleTime : '18:00',
        schedulePeriod: typeof data.schedulePeriod === 'string' ? data.schedulePeriod : 'day'
      });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const rawEmails = typeof body.emails === 'string' ? body.emails : '';
      
      // Clean and validate emails
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const cleanedList = rawEmails
        .split(',')
        .map(email => normalizeEmail(email))
        .filter(email => emailRegex.test(email));

      const cleanedEmailsString = cleanedList.join(', ');

      // Extract scheduling variables
      const scheduleEnabled = !!body.scheduleEnabled;
      
      let scheduleTime = '18:00';
      if (typeof body.scheduleTime === 'string' && /^\d{2}:\d{2}$/.test(body.scheduleTime.trim())) {
        scheduleTime = body.scheduleTime.trim();
      }

      let schedulePeriod = 'day';
      const validPeriods = ['day', 'week', 'month', 'year'];
      if (typeof body.schedulePeriod === 'string' && validPeriods.includes(body.schedulePeriod.trim().toLowerCase())) {
        schedulePeriod = body.schedulePeriod.trim().toLowerCase();
      }

      await configDocRef.set({
        emails: cleanedEmailsString,
        emailsList: cleanedList,
        scheduleEnabled,
        scheduleTime,
        schedulePeriod,
        updatedAt: new Date()
      }, { merge: true });

      sendJson(res, 200, {
        ok: true,
        emails: cleanedEmailsString,
        scheduleEnabled,
        scheduleTime,
        schedulePeriod
      });
    }
  } catch (err) {
    console.error('Reports config error:', err);
    sendJson(res, 500, { ok: false, error: 'Failed to manage reports configuration' });
  }
}
