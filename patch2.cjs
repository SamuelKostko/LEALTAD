const fs = require('fs');
const path = 'C:/Users/Alejandro/Documents/SAMUEL/CONCILIACION/functions/server.js';
let content = fs.readFileSync(path, 'utf8');

const oldCode = `
                    const cedulaBanco = String(data.cedula_emisor || '').replace(/\\D/g, '');
                    const telefonoBanco = String(data.telefono_banco || '').replace(/\\D/g, '');
                    
                    const cedulaMatch = clientCedula && cedulaBanco && (cedulaBanco.includes(clientCedula) || clientCedula.includes(cedulaBanco));
                    const phoneMatch = clientPhone && telefonoBanco && (telefonoBanco.includes(clientPhone) || clientPhone.includes(telefonoBanco));`;

const newCode = `
                    const cedulaBanco = String(data.cedula_emisor || '').replace(/\\D/g, '');
                    
                    // Normalización de teléfonos: Tomamos los últimos 10 dígitos (ignorando código de país y el 0 inicial)
                    const normalizedClientPhone = clientPhone.length >= 10 ? clientPhone.slice(-10) : clientPhone;
                    const telefonoBancoRaw = String(data.telefono_banco || '').replace(/\\D/g, '');
                    const normalizedBancoPhone = telefonoBancoRaw.length >= 10 ? telefonoBancoRaw.slice(-10) : telefonoBancoRaw;
                    
                    const cedulaMatch = clientCedula && cedulaBanco && (cedulaBanco.includes(clientCedula) || clientCedula.includes(cedulaBanco));
                    const phoneMatch = normalizedClientPhone && normalizedBancoPhone && (normalizedBancoPhone === normalizedClientPhone);`;

const oldCodeRegex = new RegExp(oldCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));

if (oldCodeRegex.test(content)) {
    content = content.replace(oldCodeRegex, newCode);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully patched phone normalization in server.js');
} else {
    console.log('Could not find the target code in server.js');
}
