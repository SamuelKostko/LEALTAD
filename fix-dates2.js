import { config } from 'dotenv';
config();
import { getFirestoreDb } from './api/_lib/firestore.js';

async function fixDates() {
    console.log('Fetching transactions...');
    const db = getFirestoreDb();
    const snap = await db.collection('transactions').where('type', '==', 'transfer').get();
    let fixedCount = 0;
    
    for (const doc of snap.docs) {
        const data = doc.data();
        let updates = {};
        
        if (typeof data.createdAt === 'string') {
            updates.createdAt = new Date(data.createdAt);
        }
        if (typeof data.processedAt === 'string') {
            updates.processedAt = new Date(data.processedAt);
        }
        
        if (Object.keys(updates).length > 0) {
            await doc.ref.update(updates);
            fixedCount++;
            console.log('Fixed doc ' + doc.id);
        }
    }
    console.log('Finished fixing ' + fixedCount + ' documents.');
    process.exit(0);
}

fixDates().catch(console.error);
