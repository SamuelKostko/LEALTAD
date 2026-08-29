import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

// Read service account from secrets folder
const serviceAccount = JSON.parse(fs.readFileSync('./secrets/firebase-admin.json', 'utf8'));

// Initialize Firebase Admin
if (process.argv[1] === import.meta.url || process.argv[1].endsWith('fix-dates.js')) {
    initializeApp({
        credential: cert(serviceAccount)
    });

    const db = getFirestore();
    
    async function fixDates() {
        console.log('Fetching transactions...');
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
    }

    fixDates().catch(console.error);
}
