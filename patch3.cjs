const fs = require('fs');
const path = 'C:/Users/Alejandro/Documents/SAMUEL/CONCILIACION/functions/server.js';
let content = fs.readFileSync(path, 'utf8');

const oldCode = `
          if (matches.length === 1) {
              const matchedTx = matches[0];
              await db.collection('transacciones').doc(matchedTx.id).update({
                  status: 'CONCILIADO',
                  referencia: reference || 'Auto-Conciliado',
                  notas: 'Aprobado automáticamente por PWA'
              });
              return res.json({ success: true, matchedId: matchedTx.id });
          }`;

const newCode = `
          if (matches.length === 1) {
              const matchedTx = matches[0];
              await db.collection('transacciones').doc(matchedTx.id).update({
                  status: 'CONCILIADO',
                  referencia: reference || 'Auto-Conciliado',
                  notas: 'Aprobado automáticamente por PWA',
                  sede: 'VMAS'
              });
              return res.json({ success: true, matchedId: matchedTx.id });
          }`;

const oldCodeAlt = `
          if (matches.length === 1) {
              const matchedTx = matches[0];
              await db.collection('transacciones').doc(matchedTx.id).update({
                  status: 'CONCILIADO',
                  referencia: reference || 'Auto-Conciliado',
                  notas: 'Aprobado automǭticamente por PWA'
              });
              return res.json({ success: true, matchedId: matchedTx.id });
          }`;

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const oldRegex = new RegExp(escapeRegExp(oldCode).replace(/\s+/g, '\\s*'));
const oldAltRegex = new RegExp(escapeRegExp(oldCodeAlt).replace(/\s+/g, '\\s*'));

if (oldRegex.test(content)) {
    content = content.replace(oldRegex, newCode);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully added sede VMAS');
} else if (oldAltRegex.test(content)) {
    content = content.replace(oldAltRegex, newCode);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully added sede VMAS (alt encoding)');
} else {
    console.log('Could not find the target code in server.js');
}
