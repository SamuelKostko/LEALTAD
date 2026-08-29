import { config } from 'dotenv';
config();
import { getFirestoreDb } from './api/_lib/firestore.js';

async function checkDates() {
    const db = getFirestoreDb();
    const snap = await db.collection('transactions').orderBy('createdAt', 'desc').limit(20).get();
    
    for (const doc of snap.docs) {
        const data = doc.data();
        console.log('Doc ' + doc.id + ' createdAt type: ' + typeof data.createdAt + ' val: ' + data.createdAt);
    }
    process.exit(0);
}

checkDates().catch(console.error);
