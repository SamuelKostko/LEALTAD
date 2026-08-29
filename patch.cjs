const fs = require('fs');
const path = 'C:/Users/Alejandro/Documents/SAMUEL/CONCILIACION/functions/server.js';
let content = fs.readFileSync(path, 'utf8');

const oldCode = `app.post('/api/verify-payment', async (req, res) => {
    try {
        const { amount, cedula, reference } = req.body;
        if (!amount) return res.status(400).json({ success: false, error: 'Monto requerido' });

        const amountClient = parseFloat(amount);
        const refClient = reference ? String(reference).trim() : '';
        const clientCedula = String(cedula || '').replace(/\\D/g, '');

        const noReportadosSnap = await db.collection('transacciones').where('status', '==', 'NO_REPORTADO').get();
        let matches = [];

        noReportadosSnap.forEach(doc => {
            const data = doc.data();
            const amountBanco = parseFloat(data.monto_banco || 0);
            
            if (Math.abs(amountBanco - amountClient) < 1) {
                if (!reference) {
                    // AutoMatch Mode
                    const cedulaBanco = String(data.cedula_emisor || '').replace(/\\D/g, '');
                    if (clientCedula && cedulaBanco && (cedulaBanco.includes(clientCedula) || clientCedula.includes(cedulaBanco))) {
                        matches.push({ id: doc.id, ...data });
                    }
                } else {
                    // Manual Mode
                    const refBanco = String(data.referencia_banco || '').trim();
                    if (refBanco.length >= 4 && refClient.length >= 4 && refBanco.slice(-4) === refClient.slice(-4)) {
                        matches.push({ id: doc.id, ...data });
                    }
                }
            }
        });`;

const newCode = `app.post('/api/verify-payment', async (req, res) => {
    try {
        const { amount, cedula, phone, reference } = req.body;
        if (!amount) return res.status(400).json({ success: false, error: 'Monto requerido' });

        const amountClient = parseFloat(amount);
        const refClient = reference ? String(reference).trim() : '';
        const clientCedula = String(cedula || '').replace(/\\D/g, '');
        const clientPhone = String(phone || '').replace(/\\D/g, '');

        const noReportadosSnap = await db.collection('transacciones').where('status', '==', 'NO_REPORTADO').get();
        let matches = [];

        noReportadosSnap.forEach(doc => {
            const data = doc.data();
            const amountBanco = parseFloat(data.monto_banco || 0);
            
            if (Math.abs(amountBanco - amountClient) < 1) {
                if (!reference) {
                    // AutoMatch Mode
                    const cedulaBanco = String(data.cedula_emisor || '').replace(/\\D/g, '');
                    const telefonoBanco = String(data.telefono_banco || '').replace(/\\D/g, '');
                    
                    const cedulaMatch = clientCedula && cedulaBanco && (cedulaBanco.includes(clientCedula) || clientCedula.includes(cedulaBanco));
                    const phoneMatch = clientPhone && telefonoBanco && (telefonoBanco.includes(clientPhone) || clientPhone.includes(telefonoBanco));

                    if (cedulaMatch || phoneMatch) {
                        matches.push({ id: doc.id, ...data });
                    }
                } else {
                    // Manual Mode
                    const refBanco = String(data.referencia_banco || '').trim();
                    if (refBanco.length >= 4 && refClient.length >= 4 && refBanco.slice(-4) === refClient.slice(-4)) {
                        matches.push({ id: doc.id, ...data });
                    }
                }
            }
        });`;

// Using regex to ignore whitespace differences
const oldCodeRegex = new RegExp(oldCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));

if (oldCodeRegex.test(content)) {
    content = content.replace(oldCodeRegex, newCode);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully patched server.js');
} else {
    console.log('Could not find the target code in server.js');
}
