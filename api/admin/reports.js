import { getFirestoreDb } from '../_lib/firestore.js';
import { sendJson } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';

function getVzlaTodayStr() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const d = {};
  parts.forEach(p => d[p.type] = p.value);
  return `${d.year}-${d.month}-${d.day}`;
}

function formatVzlaDate(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const d = {};
  parts.forEach(p => d[p.type] = p.value);
  return `${d.year}-${d.month}-${d.day}`;
}

export function getReportRange(dateStr, period) {
  // Validate date format YYYY-MM-DD
  let cleanedDateStr = String(dateStr ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanedDateStr)) {
    cleanedDateStr = getVzlaTodayStr();
  }

  const parts = cleanedDateStr.split('-');
  const yearNum = parseInt(parts[0], 10);
  const monthNum = parseInt(parts[1], 10);
  const dayNum = parseInt(parts[2], 10);

  let start, end;

  if (period === 'week') {
    // Week containing the selected date. Monday to Sunday
    const baseDate = new Date(`${cleanedDateStr}T12:00:00-04:00`);
    const dayOfWeek = baseDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + diffToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const mondayStr = formatVzlaDate(monday);
    const sundayStr = formatVzlaDate(sunday);
    
    start = new Date(`${mondayStr}T00:00:00-04:00`);
    end = new Date(`${sundayStr}T23:59:59.999-04:00`);
  } else if (period === 'month') {
    // Month containing the selected date
    const startStr = `${parts[0]}-${parts[1]}-01T00:00:00-04:00`;
    let nextYear = yearNum;
    let nextMonth = monthNum + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const nextMonthStr = String(nextMonth).padStart(2, '0');
    const endStr = `${nextYear}-${nextMonthStr}-01T00:00:00-04:00`;
    
    start = new Date(startStr);
    end = new Date(new Date(endStr).getTime() - 1);
  } else if (period === 'year') {
    // Year containing the selected date
    start = new Date(`${parts[0]}-01-01T00:00:00-04:00`);
    end = new Date(`${parts[0]}-12-31T23:59:59.999-04:00`);
  } else {
    // Default to 'day'
    start = new Date(`${cleanedDateStr}T00:00:00-04:00`);
    end = new Date(`${cleanedDateStr}T23:59:59.999-04:00`);
  }

  return { start, end, dateStr: cleanedDateStr };
}

export async function aggregateReportData(start, end) {
  const firestore = getFirestoreDb();

  // Run aggregation queries in parallel
  const [clientsSnap, txSnap, totalClientsSnap] = await Promise.all([
    firestore.collection('clientes')
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .get(),
    firestore.collection('transactions')
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .get(),
    firestore.collection('clientes').count().get()
  ]);

  const totalClients = totalClientsSnap.data().count;

  // Aggregate clients by branch
  const clientsByBranch = {};
  let totalNewClients = 0;

  clientsSnap.forEach(doc => {
    const c = doc.data() || {};
    const branch = (typeof c.sedes === 'string' && c.sedes.trim() !== '') 
      ? c.sedes.trim() 
      : (typeof c.sede === 'string' && c.sede.trim() !== '') 
        ? c.sede.trim() 
        : 'Sin Sede';
        
    clientsByBranch[branch] = (clientsByBranch[branch] || 0) + 1;
    totalNewClients++;
  });

  // Aggregate points by branch
  let totalPointsCredited = 0;
  let totalPointsRedeemed = 0;
  const creditedByBranch = {};
  const redeemedByBranch = {};

  txSnap.forEach(doc => {
    const data = doc.data() || {};
    const pts = Number(data.points) || 0;
    const status = data.status;
    const branch = (typeof data.branchName === 'string' && data.branchName.trim() !== '') 
      ? data.branchName.trim() 
      : 'Sin Sede';

    if (status !== undefined && status !== 'success') return;

    if (data.type === 'credit' || data.type === 'purchase_credit' || (!data.type && pts > 0)) {
      totalPointsCredited += pts;
      creditedByBranch[branch] = (creditedByBranch[branch] || 0) + pts;
    } else if (data.type === 'pos_charge' || data.type === 'redeem') {
      totalPointsRedeemed += pts;
      redeemedByBranch[branch] = (redeemedByBranch[branch] || 0) + pts;
    }
  });

  // Consolidate branches
  const branchesSet = new Set([
    ...Object.keys(clientsByBranch),
    ...Object.keys(creditedByBranch),
    ...Object.keys(redeemedByBranch)
  ]);

  const branches = Array.from(branchesSet).map(branchName => {
    const newClients = clientsByBranch[branchName] || 0;
    const pointsCredited = creditedByBranch[branchName] || 0;
    const pointsRedeemed = redeemedByBranch[branchName] || 0;
    const balance = pointsCredited - pointsRedeemed;

    return {
      branchName,
      newClients,
      pointsCredited,
      pointsRedeemed,
      balance
    };
  });

  // Sort branches alphabetically
  branches.sort((a, b) => a.branchName.localeCompare(b.branchName));

  return {
    totalClients,
    totalNewClients,
    totalPointsCredited,
    totalPointsRedeemed,
    totalBalance: totalPointsCredited - totalPointsRedeemed,
    branches
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!(await requireAdmin(req, res))) return;

  try {
    const url = new URL(req.url, 'http://localhost');
    const dateParam = url.searchParams.get('date');
    const periodParam = String(url.searchParams.get('period') ?? 'day').trim().toLowerCase();

    const { start, end, dateStr } = getReportRange(dateParam, periodParam);
    const reportData = await aggregateReportData(start, end);

    sendJson(res, 200, {
      ok: true,
      period: periodParam,
      date: dateStr,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      ...reportData
    });
  } catch (err) {
    console.error('Reports endpoint error:', err);
    sendJson(res, 500, { ok: false, error: 'Failed to generate report data' });
  }
}
