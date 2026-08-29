const fs = require('fs');
const path = 'C:/Users/Alejandro/Documents/SAMUEL/CONCILIACION/functions/server.js';
let content = fs.readFileSync(path, 'utf8');

const oldCode = `app.post('/api/verify-payment', async (req, res) => {
    try {
        const { amount, cedula, phone, reference } = req.body;`;

const newCode = `app.post('/api/verify-payment', async (req, res) => {
    try {
        const { amount, cedula, phone, reference, date } = req.body;`;

const oldCode2 = `                } else {
                    // Manual Mode
                    const refBanco = String(data.referencia_banco || '').trim();
                    if (refBanco.length >= 4 && refClient.length >= 4 && refBanco.slice(-4) === refClient.slice(-4)) {
                        matches.push({ id: doc.id, ...data });
                    }
                }`;

const newCode2 = `                } else {
                    // Manual Mode
                    const refBanco = String(data.referencia_banco || '').trim();
                    const refMatches = refBanco.length >= 4 && refClient.length >= 4 && refBanco.slice(-4) === refClient.slice(-4);
                    
                    let dateMatches = true;
                    if (date && date.includes('-')) {
                        const [yyyy, mm, dd] = date.split('-');
                        const formattedDate = \`\${dd}/\${mm}/\${yyyy}\`;
                        const bankDate = String(data.fecha_banco || data.fecha || '').trim();
                        if (bankDate && bankDate !== formattedDate) {
                            dateMatches = false;
                        }
                    }

                    if (refMatches && dateMatches) {
                        matches.push({ id: doc.id, ...data });
                    }
                }`;

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let patched = false;
const oldRegex = new RegExp(escapeRegExp(oldCode).replace(/\s+/g, '\\s*'));
if (oldRegex.test(content)) {
    content = content.replace(oldRegex, newCode);
    patched = true;
}

const oldRegex2 = new RegExp(escapeRegExp(oldCode2).replace(/\s+/g, '\\s*'));
if (oldRegex2.test(content)) {
    content = content.replace(oldRegex2, newCode2);
    patched = true;
}

if (patched) {
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully patched server.js with date manual match');
} else {
    console.log('Could not find the target code in server.js');
}
