const fs = require('fs');
const code = fs.readFileSync('script.js', 'utf8');

// Strip DOM-dependent parts for Node testing
const stripped = code
    .replace(/document\.addEventListener[\s\S]*$/, '')
    .replace(/function (showTab|handlePopulationUpload|handleTerminatedUpload|renderPopulationTable|renderTenureTable|renderTerminatedTable|filterPopulationTable|filterTenureTable|filterTerminatedTable|processPopulation|processTenureCalculation|singleLookup|processTerminated|showRatePreview|loadRateFile|resetRateFile|downloadPopulationCSV|downloadTenureCSV|downloadTerminatedCSV|downloadCSV)\b[\s\S]*?(?=\n\/\/|$)/g, '');

eval(stripped);

const wideCsv = fs.readFileSync('rate_file_template.csv', 'utf8');
const wide = parseRateCSV(wideCsv);
console.log('Wide - Portuguese F Mo6:',  wide.Portuguese.F.Mo6,  wide.Portuguese.F.Mo6  === 21851300 ? 'PASS' : 'FAIL');
console.log('Wide - Bilingual  F Mo36:', wide.Bilingual.F.Mo36,  wide.Bilingual.F.Mo36  === 40921000 ? 'PASS' : 'FAIL');
console.log('Wide - Portuguese Q Mo12:', wide.Portuguese.Q.Mo12, wide.Portuguese.Q.Mo12 === 11476277 ? 'PASS' : 'FAIL');
console.log('Wide - Bilingual  Q Start:',wide.Bilingual.Q.Start, wide.Bilingual.Q.Start === 16377352 ? 'PASS' : 'FAIL');

const longCsv = [
    'Language,Class,Step,Annual Rate',
    'Portuguese,F,Start,22000000','Portuguese,F,Mo6,23000000','Portuguese,F,Mo12,24000000',
    'Portuguese,F,Mo24,25000000','Portuguese,F,Mo36,26000000',
    'Portuguese,Q,Start,11000000','Portuguese,Q,Mo6,11500000','Portuguese,Q,Mo12,12000000',
    'Portuguese,Q,Mo24,12500000','Portuguese,Q,Mo36,13000000',
    'Bilingual,F,Start,33000000','Bilingual,F,Mo6,36000000','Bilingual,F,Mo12,38000000',
    'Bilingual,F,Mo24,40000000','Bilingual,F,Mo36,42000000',
    'Bilingual,Q,Start,17000000','Bilingual,Q,Mo6,18000000','Bilingual,Q,Mo12,19000000',
    'Bilingual,Q,Mo24,20000000','Bilingual,Q,Mo36,21000000'
].join('\n');

const lng = parseRateCSV(longCsv);
console.log('Long - Portuguese F Mo36:', lng.Portuguese.F.Mo36, lng.Portuguese.F.Mo36 === 26000000 ? 'PASS' : 'FAIL');
console.log('Long - Bilingual  F Mo12:', lng.Bilingual.F.Mo12,  lng.Bilingual.F.Mo12  === 38000000 ? 'PASS' : 'FAIL');

try { parseRateCSV('col1,col2\nval1,val2'); console.log('Invalid format: FAIL (should throw)'); }
catch(e) { console.log('Invalid format caught: PASS -', e.message); }

// normalizeLanguage aliases
console.log('normalizeLanguage "Spanish":', normalizeLanguage('Spanish'), normalizeLanguage('Spanish')==='Portuguese'?'PASS':'FAIL');
console.log('normalizeLanguage "English":', normalizeLanguage('English'), normalizeLanguage('English')==='Bilingual'?'PASS':'FAIL');
console.log('normalizeLanguage "Bilingual":',normalizeLanguage('Bilingual'),normalizeLanguage('Bilingual')==='Bilingual'?'PASS':'FAIL');

// Syntax check
try { new Function(code); console.log('Full syntax: OK'); }
catch(e) { console.log('Syntax ERROR:', e.message); }
