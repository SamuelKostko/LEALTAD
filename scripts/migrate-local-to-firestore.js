import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFirestoreDb() {
  const projectId = String(process.env.FIREBASE_PROJECT_ID ?? '').trim() || undefined;
  const serviceAccountJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '').trim();
  const serviceAccountPath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '').trim();

  let credential;
  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    credential = cert(parsed);
  } else if (serviceAccountPath) {
    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(__dirname, '..', serviceAccountPath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);
    credential = cert(parsed);
  } else {
    credential = applicationDefault();
  }

  if (!getApps().length) {
    initializeApp({ credential, projectId });
  }

  return getFirestore();
}

function readLocalDb(dbPath) {
  const raw = fs.readFileSync(dbPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON DB');
  parsed.cards = parsed.cards && typeof parsed.cards === 'object' ? parsed.cards : {};
  parsed.customers = parsed.customers && typeof parsed.customers === 'object' ? parsed.customers : {};
  return parsed;
}

async function main() {
  const dbPath = path.join(__dirname, '..', 'data', 'cards.json');
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Local DB not found at ${dbPath}`);
  }

  const local = readLocalDb(dbPath);
  const firestore = getFirestoreDb();

  const cardsEntries = Object.entries(local.cards);
  const customersEntries = Object.entries(local.customers);

  console.log(`Migrating ${cardsEntries.length} cards and ${customersEntries.length} customers to Firestore...`);

  const batch = firestore.batch();

  for (const [token, card] of cardsEntries) {
    const ref = firestore.collection('cards').doc(token);
    batch.set(ref, card, { merge: true });
  }

  for (const [email, customer] of customersEntries) {
    const ref = firestore.collection('customers').doc(email);
    batch.set(ref, customer, { merge: true });
  }

  await batch.commit();
  console.log('Migration complete.');
}

main().catch((err) => {
  const message = err?.message ?? String(err);
  console.error('Migration failed:', message);

  // Common: Firestore API disabled / not initialized.
  if (
    typeof message === 'string' &&
    (message.includes('firestore.googleapis.com') || message.includes('Cloud Firestore API has not been used'))
  ) {
    console.error(
      '\nAction required: enable Firestore for your project.\n' +
      '- Firebase Console: https://console.firebase.google.com/ (Project -> Firestore Database -> Create database)\n' +
      '- Or enable the API in Google Cloud: https://console.developers.google.com/apis/api/firestore.googleapis.com/overview\n' +
      'After enabling, wait 1-3 minutes and re-run: npm run migrate:firestore\n'
    );
  }
  process.exitCode = 1;
});
