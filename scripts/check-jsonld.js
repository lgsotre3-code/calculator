const fs = require('fs');
const dirs = ['pgbl-vs-vgbl', 'decimo-terceiro', 'brutto-netto-calculator', 'isa-vs-gia'];
dirs.forEach(function(d) {
  const f = d + '/index.html';
  if (!fs.existsSync(f)) { console.log('MISSING: ' + f); return; }
  const h = fs.readFileSync(f, 'utf8');
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m, n = 0;
  while ((m = re.exec(h)) !== null) {
    n++;
    try { JSON.parse(m[1]); console.log(d + ' block ' + n + ': OK'); }
    catch(e) { console.log(d + ' block ' + n + ': ERROR ' + e.message); }
  }
  console.log(d + ': ' + n + ' JSON-LD blocks');
});
