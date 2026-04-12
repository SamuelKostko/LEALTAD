const fs = require('fs');
const buf = fs.readFileSync('icons/LOGO V PUNTO VERTICAL.png');
const b64 = buf.toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><image href="data:image/png;base64,${b64}" width="100%" height="100%"/></svg>`;
fs.writeFileSync('icons/icon.svg', svg);
fs.writeFileSync('icons/icont.svg', svg);
console.log("Done");
