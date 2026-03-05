import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _firestore;

export function getFirestoreDb() {
  if (_firestore) return _firestore;

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
      : path.join(__dirname, '..', '..', serviceAccountPath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    credential = cert(parsed);
  } else {
    credential = applicationDefault();
  }

  if (!getApps().length) {
    initializeApp({ credential, projectId });
  }

  _firestore = getFirestore();
  return _firestore;
}
