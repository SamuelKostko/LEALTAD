import { getFirestoreDb } from '../_lib/firestore.js';
import { sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';

function parseCookies(header) {
  const raw = String(header ?? '');
  if (!raw) return {};
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(val);
  }
  return out;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function toIso(value) {
  const d = toDate(value);
  return d ? d.toISOString() : '';
}

function getVzlaDayStartMs(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const p = {};
  parts.forEach((x) => {
    p[x.type] = x.value;
  });
  return new Date(`${p.year}-${p.month}-${p.day}T00:00:00-04:00`).getTime();
}

function clampInt(value, { min, max, fallback }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function getSinceMsFromRange(range) {
  const dayStart = getVzlaDayStartMs();
  if (range === 'week') return dayStart - 6 * 24 * 3600 * 1000;
  if (range === 'month') return dayStart - 29 * 24 * 3600 * 1000;
  return dayStart;
}

function txTimestampMs(tx) {
  return (tx.processedAt || tx.createdAt || new Date(0)).getTime();
}

function normalizeTransaction(id, raw) {
  const data = raw || {};
  const points = Number(data.points);
  const createdAt = toDate(data.createdAt);
  const processedAt = toDate(data.processedAt);

  let type = typeof data.type === 'string' ? data.type : '';
  if (!type && points > 0) {
    type = 'credit';
  }

  return {
    id,
    type,
    status: typeof data.status === 'string' ? data.status : '',
    description: typeof data.description === 'string' ? data.description : '',
    token: typeof data.token === 'string' ? data.token : '',
    branchName: typeof data.branchName === 'string' ? data.branchName : '',
    points: Number.isFinite(points) ? points : 0,
    createdAt,
    createdAtIso: toIso(data.createdAt),
    processedAt,
    processedAtIso: toIso(data.processedAt)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    sendJson(res, 401, { error: 'No autorizado.' });
    return;
  }

  const role = String(auth.data?.role ?? '').trim().toLowerCase();
  if (role !== 'merchant') {
    sendJson(res, 403, { error: 'No autorizado.' });
    return;
  }

  const merchantId = String(auth.adminId ?? '').trim();
  if (!merchantId) {
    sendJson(res, 400, { error: 'Merchant inválido.' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const rangeRaw = String(url.searchParams.get('range') ?? 'day').trim().toLowerCase();
  const range = ['day', 'week', 'month'].includes(rangeRaw) ? rangeRaw : 'day';
  const cursor = Number(url.searchParams.get('cursor') ?? 0);
  const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 20, fallback: 8 });

  try {
    const firestore = getFirestoreDb();
    const txSnap = await firestore
      .collection('transactions')
      .where('merchantId', '==', merchantId)
      .limit(400)
      .get();

    const allTransactions = txSnap.docs
      .map((d) => normalizeTransaction(d.id, d.data()))
      .filter((t) => ['pos_charge', 'manual_credit', 'credit'].includes(t.type))
      .sort((a, b) => {
        const aMs = txTimestampMs(a);
        const bMs = txTimestampMs(b);
        return bMs - aMs;
      });

    const sinceMs = getSinceMsFromRange(range);

    let rangeChargesCount = 0;
    let rangePointsTotal = 0;
    let rangePointsCredited = 0;
    let pendingChargesCount = 0;

    for (const tx of allTransactions) {
      if (tx.status === 'pending') {
        pendingChargesCount += 1;
      }

      if (tx.status !== 'success' && tx.status !== 'completed') continue;
      const ts = txTimestampMs(tx);
      if (ts >= sinceMs) {
        if (tx.type === 'pos_charge') {
          rangeChargesCount += 1;
          rangePointsTotal += tx.points;
        } else if (tx.type === 'manual_credit' || tx.type === 'credit') {
          rangePointsCredited += tx.points;
        }
      }
    }

    const filteredByRange = allTransactions.filter((tx) => txTimestampMs(tx) >= sinceMs);
    const pageSource = Number.isFinite(cursor) && cursor > 0
      ? filteredByRange.filter((tx) => txTimestampMs(tx) < cursor)
      : filteredByRange;
    const page = pageSource.slice(0, limit);
    const hasMore = pageSource.length > limit;
    const nextCursor = hasMore && page.length ? txTimestampMs(page[page.length - 1]) : null;

    const recentCharges = page.map((tx) => ({
      id: tx.id,
      type: tx.type,
      status: tx.status,
      points: tx.points,
      description: tx.description,
      branchName: tx.branchName,
      token: tx.token,
      createdAt: tx.createdAtIso,
      processedAt: tx.processedAtIso
    }));

    sendJson(res, 200, {
      ok: true,
      merchant: {
        id: merchantId,
        name: String(auth.data?.name ?? '').trim(),
        branchName: String(auth.data?.branchName ?? '').trim()
      },
      dashboard: {
        selectedRange: range,
        rangeChargesCount,
        rangePointsTotal,
        rangePointsCredited,
        pendingChargesCount,
        status: pendingChargesCount > 0 ? 'Con cobros pendientes' : 'Operativo',
        recentCharges,
        hasMore,
        nextCursor
      }
    });
  } catch (err) {
    console.error('Merchant stats error:', err);
    sendJson(res, 500, { error: 'No se pudo cargar el dashboard del comercio.' });
  }
}
