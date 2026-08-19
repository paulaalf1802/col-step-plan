// ═══════════════════════════════════════════════════════════════
// Colombia CS Step Plan – Tenure Calculator
// Rate File effective: January 1, 2026
// ═══════════════════════════════════════════════════════════════

// ── Rate Table (July 2026) ────────────────────────────────────
// Structure: RATES[language][fullPartTime][step]
// Steps: 'Start', 'Mo6', 'Mo12', 'Mo24', 'Mo36'
// Job Code in scope: P02241, Location: VCC (Colombia)
// Source: Colombia CS Rate File July 2026
// Language labels in rate file: Spanish = Spanish-speaking, English = English
// This is the built-in default. Users can override by uploading a new rate file.
const RATES_BUILTIN = {
    Spanish: {
        F: { Start: 21766800, Mo6: 22637400, Mo12: 23543000, Mo24: 24720100, Mo36: 25708900 },
        Q: { Start: 10992234, Mo6: 11431887, Mo12: 11889215, Mo24: 12483651, Mo36: 12982995 }
    },
    English: {
        F: { Start: 33597200, Mo6: 36620900, Mo12: 38452000, Mo24: 40374600, Mo36: 42393300 },
        Q: { Start: 16966586, Mo6: 18493555, Mo12: 19418260, Mo24: 20389173, Mo36: 21408617 }
    }
};

// Active rate table — replaced when user uploads a new rate file
let RATES = JSON.parse(JSON.stringify(RATES_BUILTIN));

// Step milestone thresholds in completed months
const MILESTONES = [
    { key: 'Mo36', months: 36 },
    { key: 'Mo24', months: 24 },
    { key: 'Mo12', months: 12 },
    { key: 'Mo6',  months: 6  }
];


// ── Core Calculation Functions ────────────────────────────────

/**
 * Calculate completed months of tenure between two dates.
 * Mirrors the BRD §8.2.1 logic: completed months only.
 * Supports temp-to-regular: if tempStartDate is supplied and is earlier
 * than hireDate, it is used as the origin for tenure (break-free transition).
 *
 * BRD example: temp start Jan 15 2024 → regular May 21 2025 → tenure = 16 months ✓
 */
function calcCompletedMonths(originDate, asOfDate) {
    const start = new Date(originDate);
    const asOf  = new Date(asOfDate);

    let months = (asOf.getFullYear() - start.getFullYear()) * 12
               + (asOf.getMonth()    - start.getMonth());

    // If the day-of-month hasn't been reached yet, the final month isn't complete
    if (asOf.getDate() < start.getDate()) months--;

    return Math.max(0, months);
}

/**
 * Determine the current Step milestone label given completed months.
 * Returns: 'Mo36' | 'Mo24' | 'Mo12' | 'Mo6' | 'Start'
 */
function getStep(completedMonths) {
    for (const m of MILESTONES) {
        if (completedMonths >= m.months) return m.key;
    }
    return 'Start';
}

/**
 * Determine which Step milestone an employee REACHES within a date window.
 * Returns an array of { step, milestoneDate } for milestones hit in [fromDate, toDate].
 */
function getMilestonesInRange(originDate, fromDate, toDate) {
    const start = new Date(originDate);
    const from  = new Date(fromDate);
    const to    = new Date(toDate);
    const hits  = [];

    for (const m of MILESTONES) {
        // Date on which this milestone is reached
        const milestoneDate = new Date(start);
        milestoneDate.setMonth(milestoneDate.getMonth() + m.months);

        if (milestoneDate >= from && milestoneDate <= to) {
            hits.push({ step: m.key, milestoneDate });
        }
    }
    return hits;
}

/**
 * Map shift code → language classification per BRD §8.2.3
 * QuickSight codes: ~ = Spanish  |  3, B, G = English
 * ADP/People Portal codes: 0 = Spanish  |  1, 2, 3 = English
 *
 * Fallback: if shift code is blank, infer from business title keywords.
 * NAEN / SDS / HBS / ENG → English
 * NASP / ACC / CAP / ES  → Spanish  (note: "ES CS" = Spanish-language CS)
 * CSBR → English (Brazil queue, English-trained)
 */
function getLanguage(shiftCode, businessTitle) {
    const code = String(shiftCode).trim();
    if (['~', '0'].includes(code))            return 'Spanish';
    if (['1','2','3','B','G'].includes(code)) return 'English';

    // Shift code not available — infer from business title
    if (businessTitle) {
        const t = String(businessTitle).toUpperCase();
        if (/\bNAEN\b|SDS|HBS|\bENG\b|CSBR/.test(t)) return 'English';
        if (/\bNASP\b|\bES\s+CS\b|\bES\b.*CS|CAP\b|ACC\b/.test(t))  return 'Spanish';
        // "CS Associate" with no qualifier — can't determine, leave Unknown
    }
    return 'Unknown';
}

/**
 * Look up the proposed pay rate from the rate table.
 * Returns null if the combination is not found.
 */
function getProposedRate(language, fpt, step) {
    return (RATES[language]?.[fpt]?.[step]) ?? null;
}

/**
 * BRD §8.2.4 – Pay Rate Difference
 * §8.2.5 – Recommendation
 */
function getRecommendation(proposedRate, currentRate) {
    if (proposedRate === null) return { diff: null, recommendation: 'N/A' };
    const diff = proposedRate - currentRate;
    // BRD §8.2.5:
    // "Upload"    → proposed > current  (employee needs a pay rate adjustment uploaded to People Portal)
    // "No Action" → proposed <= current (employee is already at or above the step rate)
    const recommendation = proposedRate > currentRate ? 'Upload' : 'No Action';
    return { diff, recommendation };
}

/**
 * Generate a detailed comment for the Comments column.
 *
 * Rules:
 *  - Rate Not Found   → language/class combo has no rate defined
 *  - Check Hire Date  → hire date is missing, future-dated, or produces 0/negative tenure
 *  - Review Required  → employee is underpaid AND tenure looks suspicious:
 *                        · tenureMonths doesn't match the milestone step claimed
 *                        · hire date is after the reference/milestone date
 *                        · current salary is 0
 *  - Underpaid        → proposed > current, tenure looks valid
 *  - Overpaid         → current > proposed
 *  - Aligned          → proposed ≈ current (within 1 COP rounding tolerance)
 *
 * @param {object} p
 *   proposedRate    {number|null}
 *   currentRate     {number}
 *   diff            {number|null}
 *   tenureMonths    {number}
 *   step            {string}        e.g. 'Mo24'
 *   hireDate        {string}        YYYY-MM-DD
 *   refDate         {string}        YYYY-MM-DD  (reference or milestone date)
 *   language        {string}
 */
function getComment({ proposedRate, currentRate, diff, tenureMonths, step, hireDate, refDate, language }) {

    // 1. No rate available
    if (proposedRate === null) {
        return language === 'Unknown'
            ? 'Rate Not Found – unrecognized shift code'
            : 'Rate Not Found – no rate for this language/class';
    }

    // 2. Hire date issues
    if (!hireDate) return 'Check Hire Date – missing';
    const hire = new Date(hireDate);
    const ref  = new Date(refDate);
    if (isNaN(hire.getTime())) return 'Check Hire Date – invalid date';
    if (hire > ref)            return 'Check Hire Date – hire date is after reference date';
    // tenureMonths=0 is valid for brand-new hires at the Start step; only flag if negative or step doesn't match
    if (tenureMonths < 0)      return 'Check Hire Date – tenure is negative';

    // 3. Validate that tenure months are consistent with the step label
    //    e.g. step = Mo24 requires tenureMonths >= 24; if not → mismatch
    const stepMinMonths = { Start: 0, Mo6: 6, Mo12: 12, Mo24: 24, Mo36: 36 };
    const minRequired = stepMinMonths[step] ?? 0;
    const tenureMismatch = tenureMonths < minRequired;

    // 4. Zero or suspicious salary
    const zeroSalary = currentRate <= 0;

    // 5. Build comment
    if (diff > 0) {
        // Underpaid scenario — check for anomalies
        if (tenureMismatch || zeroSalary) {
            const reasons = [];
            if (tenureMismatch) reasons.push(`tenure (${tenureMonths}m) doesn't match step ${step} (needs ≥${minRequired}m)`);
            if (zeroSalary)     reasons.push('current salary is zero');
            return 'Review Required – underpaid & ' + reasons.join('; ');
        }
        return 'Underpaid';
    }

    if (diff < 0) return 'Overpaid';
    return 'Aligned';  // diff === 0
}

/**
 * Determine the effective tenure origin.
 * If a temp start date is provided and predates the hire date,
 * use the temp start date (break-free transition per BRD §8.2.1).
 */
function getTenureOrigin(hireDate, tempStartDate) {
    if (!tempStartDate) return hireDate;
    const hire = new Date(hireDate);
    const temp = new Date(tempStartDate);
    return temp < hire ? tempStartDate : hireDate;
}


// ── CSV Parsing ───────────────────────────────────────────────

/**
 * Parse a CSV value: strips surrounding quotes and trims whitespace.
 */
function parseCSVValue(v) {
    if (!v) return '';
    v = v.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1).trim();
    }
    return v;
}

/**
 * Split a CSV line respecting quoted fields.
 */
function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(parseCSVValue(current));
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(parseCSVValue(current));
    return result;
}

/**
 * Map a header name (lowercase, trimmed) to a canonical field key.
 * Supports both PeopleSoft export names and simple column names.
 */
function mapHeader(raw) {
    const h = raw.toLowerCase().replace(/[\s"']+/g, '_').replace(/^_+|_+$/g, '');
    // Employee ID
    if (/^(emplid|employee_id|emp_id|id)$/.test(h))                          return 'employeeId';
    // Name
    if (/name/.test(h))                                                        return 'name';
    // Full / Part time
    if (/full.part|part.time|fpt|full_part_time_code/.test(h))                return 'fpt';
    // Job code
    if (/^job_code$|^jobcode$/.test(h))                                        return 'jobCode';
    // Hire date — last_hire_date takes priority over other date fields
    if (/last.hire|hire.date|job_last_hire/.test(h))                           return 'hireDate';
    // Shift code
    if (/shift/.test(h))                                                        return 'shiftCode';
    // Business title — used as language fallback when shift code is absent
    if (/^business_title$|^businesstitle$|^job_title/.test(h))                return 'businessTitle';
    // Location
    if (/location|loc_code|building/.test(h))                                  return 'locationCode';
    // Current salary / comp rate
    if (/comp|salary|rate|annual/.test(h) && !/proposed|new/.test(h))         return 'currentSalary';
    // Temp start date
    if (/temp.start|temp_date/.test(h))                                        return 'tempStartDate';
    return null; // unmapped column — ignored
}

/**
 * Parse CSV text into employee objects.
 * Supports:
 *   - PeopleSoft exports (header row with PS field names, quoted values)
 *   - Simple headerless CSV (positional: ID, Name, F/P, JobCode, HireDate, Shift, Location, Salary)
 */
function parseCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const firstCols = splitCSVLine(lines[0]);
    const firstCell = firstCols[0];

    // Detect header: first cell looks like a column name (letters/underscores, not an ID like EMP001 or 112399501)
    const isHeaderCell = /^[a-zA-Z_]/.test(firstCell) && !/^[A-Z]{1,4}\d+$/.test(firstCell);

    if (isHeaderCell) {
        // ── Header-based parsing (PeopleSoft or named CSV) ──
        const headerMap = firstCols.map(mapHeader); // index → canonical field or null

        return lines.slice(1).map(line => {
            const vals = splitCSVLine(line);
            const row = {};
            headerMap.forEach((field, i) => {
                if (field) row[field] = vals[i] ?? '';
            });
            return row;
        })
        .map(row => {
            const rawFpt = (row.fpt || 'F').toUpperCase();
            return {
                employeeId:    row.employeeId    || '',
                name:          row.name          || '',
                fpt:           rawFpt === 'P' ? 'Q' : rawFpt,
                jobCode:       row.jobCode       || '',
                hireDate:      normalizeDate(row.hireDate || ''),
                shiftCode:     row.shiftCode     || '',
                businessTitle: row.businessTitle || '',
                locationCode:  row.locationCode  || '',
                currentSalary: parseSalary(row.currentSalary),
                tempStartDate: normalizeDate(row.tempStartDate || '')
            };
        })
        .filter(r => r.employeeId && r.hireDate);

    } else {
        // ── Positional parsing (simple headerless CSV) ──
        return lines.map(line => {
            const parts = splitCSVLine(line);
            const rawFpt = (parts[2] || 'F').toUpperCase();
            return {
                employeeId:    parts[0] || '',
                name:          parts[1] || '',
                fpt:           rawFpt === 'P' ? 'Q' : rawFpt,
                jobCode:       parts[3] || '',
                hireDate:      normalizeDate(parts[4] || ''),
                shiftCode:     parts[5] || '',
                locationCode:  parts[6] || '',
                currentSalary: parseFloat(String(parts[7] || '0').replace(/[^0-9.-]/g, '')) || 0,
                tempStartDate: normalizeDate(parts[8] || '')
            };
        })
        .filter(r => r.employeeId && r.hireDate);
    }
}

/**
 * Normalize a date string to YYYY-MM-DD.
 * Handles: YYYY-MM-DD, MM/DD/YYYY, DD-Mon-YYYY, and timestamps like 2025-10-07 00:00:00
 */
function parseSalary(raw) {
    if (!raw) return 0;
    const cleaned = String(raw).replace(/[^0-9.]/g, '');
    const val = parseFloat(cleaned) || 0;
    // Detect PeopleSoft decimal export issue: 33597.2 → should be 33597200
    // COP salaries are always in the millions; if < 1,000,000 with a decimal, multiply by 1000
    if (val > 0 && val < 1000000 && cleaned.includes('.')) {
        return Math.round(val * 1000);
    }
    return Math.round(val);
}

function normalizeDate(raw) {
    if (!raw) return '';
    raw = raw.trim();
    // Already YYYY-MM-DD or starts with YYYY-MM-DD (timestamp)
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    // MM/DD/YYYY
    const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
    // DD/MM/YYYY
    const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    return raw;
}

/**
 * Parse terminated employees CSV.
 * Supports header-based (PeopleSoft) and positional formats.
 * Positional columns: Employee ID, Name, Last Hire Date, Termination Date, Job Code, Location Code, Final Salary
 */
function parseTerminatedCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const firstCols = splitCSVLine(lines[0]);
    const firstCell = firstCols[0];
    const isHeaderCell = /^[a-zA-Z_]/.test(firstCell) && !/^[A-Z]{1,4}\d+$/.test(firstCell);

    if (isHeaderCell) {
        // Map termination-specific headers — supports both simple and full PeopleSoft exports
        const mapTermHeader = (raw) => {
            const h = raw.toLowerCase().replace(/[\s"']+/g, '_').replace(/^_+|_+$/g, '');
            if (/^(emplid|employee_id|emp_id|id)$/.test(h))                    return 'employeeId';
            if (h === 'full_name' || h === 'display_name')                      return 'name';
            if (/name/.test(h) && !/(login|title|supervisor|reports)/.test(h))  return 'name';
            if (/termination_effective_date/.test(h))                           return 'terminationDate';
            if (/last.hire|hire.date|job_last_hire/.test(h))                    return 'hireDate';
            if (/term|separation|end.date/.test(h))                             return 'terminationDate';
            if (/^job_code$|^jobcode$/.test(h))                                 return 'jobCode';
            if (h === 'location_code' || h === 'loc_code')                      return 'locationCode';
            if (h === 'location_building_code')                                 return 'locationBuildingCode';
            if (/comp|salary|rate|annual/.test(h) && !/title|name/.test(h))    return 'finalSalary';
            if (/business_title|job_title/.test(h))                             return 'businessTitle';
            if (h === 'full_part_time' || h === 'job_full_time')                return 'fpt';
            return null;
        };

        const headerMap = firstCols.map(mapTermHeader);
        return lines.slice(1).map(line => {
            const vals = splitCSVLine(line);
            const row = {};
            headerMap.forEach((field, i) => { if (field) row[field] = vals[i] ?? ''; });
            // Normalise fpt: "Full-Time" / 1 / F → "F", else "Q"
            const rawFpt = String(row.fpt || 'F').toLowerCase();
            const fpt = (rawFpt.includes('full') || rawFpt === '1' || rawFpt === 'f') ? 'F' : 'Q';
            // Location: prefer building code (VCCC), fall back to location code (4463)
            const locationCode = (row.locationBuildingCode || row.locationCode || '').trim();
            return {
                employeeId:      row.employeeId || '',
                name:            row.name || '',
                hireDate:        normalizeDate(row.hireDate || ''),
                terminationDate: normalizeDate(row.terminationDate || ''),
                jobCode:         row.jobCode || '',
                locationCode,
                finalSalary:     parseFloat(String(row.finalSalary || '0').replace(/[^0-9.-]/g, '')) || 0,
                businessTitle:   row.businessTitle || '',
                fpt
            };
        }).filter(r => r.employeeId && r.terminationDate);
    } else {
        return lines.map(line => {
            const p = splitCSVLine(line);
            const rawFpt = (p[2] || 'F').toUpperCase();
            return {
                employeeId:      p[0] || '',
                name:            p[1] || '',
                hireDate:        normalizeDate(p[3] || ''),
                terminationDate: normalizeDate(p[4] || ''),
                jobCode:         p[5] || '',
                locationCode:    p[6] || '',
                finalSalary:     parseFloat(String(p[7] || '0').replace(/[^0-9.-]/g, '')) || 0,
                businessTitle:   '',
                fpt:             rawFpt === 'P' ? 'Q' : rawFpt || 'F'
            };
        }).filter(r => r.employeeId && r.terminationDate);
    }
}


// ── In-memory stores ──────────────────────────────────────────
let populationData   = [];
let tenureData       = [];
let terminatedData   = [];

// ── Tab Navigation ────────────────────────────────────────────
function showTab(tabName, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    if (btn) btn.classList.add('active');
}

// ── File Upload Handlers ──────────────────────────────────────
function handlePopulationUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('popPasteData').value = e.target.result; };
    reader.readAsText(file);
}

function handleTerminatedUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('termPasteData').value = e.target.result; };
    reader.readAsText(file);
}

// ── Utility: Format COP ───────────────────────────────────────
function fmtCOP(n) {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtNum(n) {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('es-CO');
}

// Map comment text to a CSS class key
function commentClass(comment) {
    if (!comment) return 'neutral';
    const c = comment.toLowerCase();
    if (c === 'aligned')                   return 'aligned';
    if (c === 'overpaid')                  return 'overpaid';
    if (c === 'underpaid')                 return 'underpaid';
    if (c.startsWith('review required'))   return 'review';
    if (c.startsWith('check hire date'))   return 'check';
    if (c.startsWith('rate not found'))    return 'notfound';
    return 'neutral';
}

// ── Utility: Download CSV ─────────────────────────────────────
function downloadCSV(rows, filename) {
    if (!rows.length) return alert('No data to download.');
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','),
        ...rows.map(r => headers.map(h => {
            const v = r[h] ?? '';
            return String(v).includes(',') ? `"${v}"` : v;
        }).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}


// ═══════════════════════════════════════════════════════════════
// RATE FILE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Expected CSV format (same layout as the Excel rate file):
 *
 *   Language,Class,Start,Mo6,Mo12,Mo24,Mo36
 *   Spanish,F,21010860,21851300,22725300,23861600,24816100
 *   Spanish,Q,10610484,11034907,11476277,12050108,12532131
 *   English,F,32430400,35349100,37116600,38972400,40921000
 *   English,Q,16377352,17851296,18743883,19681062,20665105
 *
 * Also accepts the PeopleSoft-style export from the Excel:
 *   Language,Class,Step,Annual Rate
 *   Spanish,F,Start,21010860
 *   Spanish,F,Mo6,21851300
 *   ...
 */
function loadRateFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const newRates = parseRateCSV(e.target.result);
            RATES = newRates;

            // Extract effective date from filename if present (e.g. "Colombia CS Rate File 06 Jan 2026.csv")
            const dateMatch = file.name.match(/(\d{1,2}[\s_-][A-Za-z]+[\s_-]\d{4}|\d{4}[-_]\d{2}[-_]\d{2})/);
            const dateLabel = dateMatch ? dateMatch[0].replace(/[_-]/g,' ') : file.name.replace('.csv','');

            document.getElementById('rateFileLabel').textContent = dateLabel + ' (uploaded)';
            document.getElementById('rateResetBtn').style.display = 'inline-block';
            document.getElementById('rateFileError').classList.add('hidden');

            // Flash the banner green to confirm
            const banner = document.getElementById('rateBanner');
            banner.classList.add('rate-banner-success');
            setTimeout(() => banner.classList.remove('rate-banner-success'), 2000);

            showRatePreview(newRates, dateLabel);

        } catch(err) {
            const errEl = document.getElementById('rateFileError');
            errEl.textContent = '⚠ ' + err.message;
            errEl.classList.remove('hidden');
        }
        // Reset input so same file can be re-uploaded
        event.target.value = '';
    };
    reader.readAsText(file);
}

function resetRateFile() {
    RATES = JSON.parse(JSON.stringify(RATES_BUILTIN));
    document.getElementById('rateFileLabel').textContent = 'July 2026 (built-in)';
    document.getElementById('rateResetBtn').style.display = 'none';
    document.getElementById('rateFileError').classList.add('hidden');
    document.getElementById('ratePreview').classList.add('hidden');
}

/**
 * Parse rate file CSV into the RATES structure.
 * Supports two formats:
 *   Wide:  Language, Class, Start, Mo6, Mo12, Mo24, Mo36
 *   Long:  Language, Class, Step, Annual Rate  (or Annual_Rate / Rate)
 */
function parseRateCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) throw new Error('Rate file is empty or has only one line.');

    const headers = splitCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[\s"'_]+/g,''));
    const dataLines = lines.slice(1);

    const newRates = { Spanish: { F:{}, Q:{} }, English: { F:{}, Q:{} } };
    const STEPS = ['Start','Mo6','Mo12','Mo24','Mo36'];

    // Detect format
    const isWide = headers.includes('start') || headers.includes('mo6');
    const isLong = headers.includes('step') && (headers.includes('annualrate') || headers.includes('rate') || headers.includes('annualbasesalary'));

    if (!isWide && !isLong) {
        throw new Error('Unrecognized rate file format. Expected columns: Language, Class, Start, Mo6, Mo12, Mo24, Mo36  —or—  Language, Class, Step, Annual Rate');
    }

    if (isWide) {
        dataLines.forEach((line, i) => {
            const cols = splitCSVLine(line);
            const lang  = normalizeLanguage(cols[headers.indexOf('language')] || cols[0]);
            const cls   = (cols[headers.indexOf('class')] || cols[1] || '').toUpperCase().trim();
            if (!lang || !['F','Q'].includes(cls)) return;
            STEPS.forEach(step => {
                const idx = headers.indexOf(step.toLowerCase());
                if (idx >= 0) {
                    const val = parseFloat(String(cols[idx] || '0').replace(/[^0-9.-]/g,''));
                    if (!isNaN(val) && val > 0) newRates[lang][cls][step] = val;
                }
            });
        });
    } else {
        // Long format
        const stepIdx = headers.indexOf('step');
        const rateIdx = headers.findIndex(h => h.includes('rate') || h.includes('salary'));
        const langIdx = headers.indexOf('language');
        const clsIdx  = headers.indexOf('class');

        dataLines.forEach(line => {
            const cols = splitCSVLine(line);
            const lang = normalizeLanguage(cols[langIdx] || cols[0]);
            const cls  = (cols[clsIdx]  || cols[1] || '').toUpperCase().trim();
            const step = normalizeStep(cols[stepIdx] || '');
            const val  = parseFloat(String(cols[rateIdx] || '0').replace(/[^0-9.-]/g,''));
            if (!lang || !['F','Q'].includes(cls) || !step || isNaN(val) || val <= 0) return;
            newRates[lang][cls][step] = val;
        });
    }

    // Validate at least one rate was loaded
    const totalRates = Object.values(newRates).flatMap(l => Object.values(l)).flatMap(c => Object.values(c)).length;
    if (totalRates === 0) throw new Error('No valid rates found. Check the file format and try again.');

    return newRates;
}

function normalizeLanguage(raw) {
    const v = (raw || '').toLowerCase().trim().replace(/[^a-z]/g,'');
    if (v.includes('port') || v.includes('spanish') || v === 'pt') return 'Spanish';
    if (v.includes('bil')  || v.includes('english') || v.includes('eng')) return 'English';
    return null;
}

function normalizeStep(raw) {
    const v = (raw || '').toLowerCase().trim().replace(/[^a-z0-9]/g,'');
    if (v === 'start' || v === '0' || v === 'mo0') return 'Start';
    if (v === 'mo6'  || v === '6')  return 'Mo6';
    if (v === 'mo12' || v === '12') return 'Mo12';
    if (v === 'mo24' || v === '24') return 'Mo24';
    if (v === 'mo36' || v === '36') return 'Mo36';
    return null;
}

function showRatePreview(rates, label) {
    const el = document.getElementById('ratePreview');
    if (!el) return;

    const fmt = n => n ? n.toLocaleString('es-CO') : '—';
    let html = `<p class="rate-preview-title">✓ Rate file loaded: <strong>${label}</strong></p>
    <table class="rate-preview-table">
        <thead><tr><th>Language</th><th>Class</th><th>Start</th><th>Mo6</th><th>Mo12</th><th>Mo24</th><th>Mo36</th></tr></thead>
        <tbody>`;
    ['Spanish','English'].forEach(lang => {
        ['F','Q'].forEach(cls => {
            const r = rates[lang]?.[cls] || {};
            html += `<tr>
                <td>${lang}</td><td>${cls}</td>
                <td>${fmt(r.Start)}</td><td>${fmt(r.Mo6)}</td>
                <td>${fmt(r.Mo12)}</td><td>${fmt(r.Mo24)}</td><td>${fmt(r.Mo36)}</td>
            </tr>`;
        });
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    el.classList.remove('hidden');
}



function processPopulation() {
    const text = document.getElementById('popPasteData').value.trim();
    const refDateVal = document.getElementById('popCalcDate').value;

    if (!text) return alert('Please upload or paste employee data.');
    if (!refDateVal) return alert('Please select a Reference Date.');

    const employees = parseCSV(text);
    if (!employees.length) return alert('No valid employee records found. Check CSV format.');

    populationData = employees.map(emp => {
        const origin        = getTenureOrigin(emp.hireDate, emp.tempStartDate);
        const tenureMonths  = calcCompletedMonths(origin, refDateVal);
        const step          = getStep(tenureMonths);
        const language      = getLanguage(emp.shiftCode, emp.businessTitle);
        const proposedRate  = getProposedRate(language, emp.fpt, step);
        const { diff, recommendation: rawReco } = getRecommendation(proposedRate, emp.currentSalary);
        // Population tab: underpaid employees are not milestone-driven → Review Discrepancy
        const recommendation = rawReco === 'Upload' ? 'Review Discrepancy' : rawReco;
        const comment       = getComment({
            proposedRate, currentRate: emp.currentSalary, diff,
            tenureMonths, step, hireDate: emp.hireDate,
            refDate: refDateVal, language
        });

        return {
            ...emp,
            tenureOrigin:   origin,
            tenureMonths,
            step,
            language,
            proposedRate,
            diff,
            recommendation,
            comment,
            refDate:        refDateVal
        };
    });

    renderPopulationTable(populationData);
    document.getElementById('populationResults').classList.remove('hidden');
    document.getElementById('popFilters').style.display = 'flex';
}

function filterPopulationTable() {
    const empFilter  = document.getElementById('popEmpIdFilter').value.trim();
    const langFilter = document.getElementById('popLanguageFilter').value;
    const stepFilter = document.getElementById('popStepFilter').value;

    const empIds = empFilter ? empFilter.split(',').map(e => e.trim().toUpperCase()) : [];

    const filtered = populationData.filter(r => {
        if (empIds.length && !empIds.includes(r.employeeId.toUpperCase())) return false;
        if (langFilter && r.language !== langFilter) return false;
        if (stepFilter && r.step !== stepFilter) return false;
        return true;
    });

    renderPopulationTable(filtered);
}

function renderPopulationTable(rows) {
    const upload   = rows.filter(r => r.recommendation === 'Review Discrepancy').length;
    const noAction = rows.filter(r => r.recommendation === 'No Action').length;

    document.getElementById('popSummary').innerHTML = `
        <div class="summary-grid">
            <div class="stat"><span class="stat-value">${rows.length}</span><span class="stat-label">Total Employees</span></div>
            <div class="stat upload"><span class="stat-value">${upload}</span><span class="stat-label">Review Discrepancy</span></div>
            <div class="stat no-action"><span class="stat-value">${noAction}</span><span class="stat-label">No Action</span></div>
        </div>
    `;

    if (!rows.length) {
        document.getElementById('popTableContainer').innerHTML = '<p class="no-data">No employees match the selected filters.</p>';
        return;
    }

    let html = `<table><thead><tr>
        <th>Employee ID</th><th>Name</th><th>F/P</th><th>Job Code</th>
        <th>Last Hire Date</th><th>Shift Code</th><th>Language</th>
        <th>Location</th><th>Tenure (Months)</th><th>Step</th>
        <th>Current Salary (COP)</th><th>Proposed Rate (COP)</th>
        <th>Difference (COP)</th><th>Recommendation</th><th>Comments</th>
    </tr></thead><tbody>`;

    rows.forEach(r => {
        const diffClass  = r.diff > 0 ? 'diff-positive' : r.diff < 0 ? 'diff-negative' : '';
        const tempLabel  = r.tenureOrigin !== r.hireDate
            ? `${r.hireDate} <span class="temp-badge" title="Tenure counted from ${r.tenureOrigin}">TEMP ↑</span>`
            : r.hireDate;
        html += `<tr>
            <td>${r.employeeId}</td>
            <td>${r.name}</td>
            <td>${r.fpt}</td>
            <td>${r.jobCode}</td>
            <td>${tempLabel}</td>
            <td>${r.shiftCode}</td>
            <td><span class="lang-badge lang-${r.language.toLowerCase()}">${r.language}</span></td>
            <td>${r.locationCode}</td>
            <td class="num">${r.tenureMonths}</td>
            <td><span class="step-badge">${r.step}</span></td>
            <td class="num">${fmtNum(r.currentSalary)}</td>
            <td class="num">${r.proposedRate ? fmtNum(r.proposedRate) : '—'}</td>
            <td class="num ${diffClass}">${r.diff !== null ? fmtNum(-r.diff) : '—'}</td>
            <td><span class="reco-badge reco-${r.recommendation.replace(' ','-').toLowerCase()}">${r.recommendation}</span></td>
            <td><span class="comment-badge comment-${commentClass(r.comment)}">${r.comment}</span></td>
        </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('popTableContainer').innerHTML = html;
}

function downloadPopulationCSV() {
    const rows = populationData.map(r => ({
        employee_id:       r.employeeId,
        name:              r.name,
        full_part_time:    r.fpt,
        job_code:          r.jobCode,
        last_hire_date:    r.hireDate,
        tenure_origin:     r.tenureOrigin,
        shift_code:        r.shiftCode,
        language:          r.language,
        location_code:     r.locationCode,
        tenure_months:     r.tenureMonths,
        step:              r.step,
        current_salary:    r.currentSalary,
        proposed_rate:     r.proposedRate ?? '',
        difference:        r.diff !== null && r.diff !== undefined ? -r.diff : '',
        recommendation:    r.recommendation,
        comments:          r.comment
    }));
    downloadCSV(rows, `col_cs_population_${new Date().toISOString().split('T')[0]}.csv`);
}


// ═══════════════════════════════════════════════════════════════
// TAB 2 – Tenure Calculation (Milestone Date Range)
// ═══════════════════════════════════════════════════════════════

function processTenureCalculation() {
    const fromVal = document.getElementById('tenureStartDate').value;
    const toVal   = document.getElementById('tenureEndDate').value;
    const text    = document.getElementById('popPasteData').value.trim(); // reuse same roster

    if (!fromVal || !toVal) return alert('Please select both Effective Date From and To.');
    if (new Date(fromVal) > new Date(toVal)) return alert('Date From must be on or before Date To.');
    if (!text) return alert('Please load a roster first (use the Eligible CS Population tab to paste/upload data).');

    const employees = parseCSV(text);
    if (!employees.length) return alert('No valid employee records found. Check the roster in the Population tab.');

    tenureData = [];

    employees.forEach(emp => {
        const origin = getTenureOrigin(emp.hireDate, emp.tempStartDate);
        const hits   = getMilestonesInRange(origin, fromVal, toVal);

        hits.forEach(({ step, milestoneDate }) => {
            const milestoneDateStr = milestoneDate.toISOString().split('T')[0];
            const tenureMonths     = calcCompletedMonths(origin, milestoneDateStr);
            const language         = getLanguage(emp.shiftCode, emp.businessTitle);
            const proposedRate     = getProposedRate(language, emp.fpt, step);
            const { diff, recommendation: rawReco } = getRecommendation(proposedRate, emp.currentSalary);
            // Tenure tab: underpaid employees are milestone-driven → TPR Needed
            const recommendation = rawReco === 'Upload' ? 'TPR Needed' : rawReco;
            const comment          = getComment({
                proposedRate, currentRate: emp.currentSalary, diff,
                tenureMonths, step, hireDate: emp.hireDate,
                refDate: milestoneDateStr, language
            });

            tenureData.push({
                ...emp,
                tenureOrigin:    origin,
                milestoneDate:   milestoneDateStr,
                tenureMonths,
                step,
                language,
                proposedRate,
                diff,
                recommendation,
                comment
            });
        });
    });

    renderTenureTable(tenureData);
    document.getElementById('tenureResults').classList.remove('hidden');
    document.getElementById('tenureFilters').style.display = 'flex';
}

function filterTenureTable() {
    const empFilter  = document.getElementById('tenureEmpIdFilter').value.trim();
    const stepFilter = document.getElementById('tenureStepFilter').value;
    const recoFilter = document.getElementById('tenureRecoFilter').value;

    const empIds = empFilter ? empFilter.split(',').map(e => e.trim().toUpperCase()) : [];

    const filtered = tenureData.filter(r => {
        if (empIds.length && !empIds.includes(r.employeeId.toUpperCase())) return false;
        if (stepFilter && r.step !== stepFilter) return false;
        if (recoFilter && r.recommendation !== recoFilter) return false;
        return true;
    });

    renderTenureTable(filtered);
}

function renderTenureTable(rows) {
    const upload   = rows.filter(r => r.recommendation === 'TPR Needed').length;
    const noAction = rows.filter(r => r.recommendation === 'No Action').length;

    document.getElementById('tenureSummary').innerHTML = `
        <div class="summary-grid">
            <div class="stat"><span class="stat-value">${rows.length}</span><span class="stat-label">Milestone Events</span></div>
            <div class="stat upload"><span class="stat-value">${upload}</span><span class="stat-label">TPR Needed</span></div>
            <div class="stat no-action"><span class="stat-value">${noAction}</span><span class="stat-label">No Action</span></div>
        </div>
    `;

    if (!rows.length) {
        document.getElementById('tenureTableContainer').innerHTML = '<p class="no-data">No employees reach a milestone in the selected date range.</p>';
        return;
    }

    let html = `<table><thead><tr>
        <th>Employee ID</th><th>Name</th><th>F/P</th><th>Job Code</th>
        <th>Last Hire Date</th><th>Milestone Date</th><th>Tenure (Months)</th>
        <th>Step Milestone</th><th>Language</th><th>Location</th>
        <th>Current Salary (COP)</th><th>Proposed Rate (COP)</th>
        <th>Difference (COP)</th><th>Recommendation</th><th>Comments</th>
    </tr></thead><tbody>`;

    rows.forEach(r => {
        const diffClass  = r.diff > 0 ? 'diff-positive' : r.diff < 0 ? 'diff-negative' : '';
        const tempLabel  = r.tenureOrigin !== r.hireDate
            ? `${r.hireDate} <span class="temp-badge" title="Tenure counted from ${r.tenureOrigin}">TEMP ↑</span>`
            : r.hireDate;
        html += `<tr>
            <td>${r.employeeId}</td>
            <td>${r.name}</td>
            <td>${r.fpt}</td>
            <td>${r.jobCode}</td>
            <td>${tempLabel}</td>
            <td>${r.milestoneDate}</td>
            <td class="num">${r.tenureMonths}</td>
            <td><span class="step-badge">${r.step}</span></td>
            <td><span class="lang-badge lang-${r.language.toLowerCase()}">${r.language}</span></td>
            <td>${r.locationCode}</td>
            <td class="num">${fmtNum(r.currentSalary)}</td>
            <td class="num">${r.proposedRate ? fmtNum(r.proposedRate) : '—'}</td>
            <td class="num ${diffClass}">${r.diff !== null ? fmtNum(r.diff) : '—'}</td>
            <td><span class="reco-badge reco-${r.recommendation.replace(' ','-').toLowerCase()}">${r.recommendation}</span></td>
            <td><span class="comment-badge comment-${commentClass(r.comment)}">${r.comment}</span></td>
        </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('tenureTableContainer').innerHTML = html;
}

function downloadTenureCSV() {
    const rows = tenureData.map(r => ({
        employee_id:       r.employeeId,
        name:              r.name,
        full_part_time:    r.fpt,
        job_code:          r.jobCode,
        tenure_origin:     r.tenureOrigin,
        milestone_date:    r.milestoneDate,
        tenure_months:     r.tenureMonths,
        step:              r.step,
        language:          r.language,
        location_code:     r.locationCode,
        current_salary:    r.currentSalary,
        proposed_rate:     r.proposedRate ?? '',
        difference:        r.diff ?? '',
        recommendation:    r.recommendation,
        comments:          r.comment
    }));
    downloadCSV(rows, `col_cs_tenure_milestones_${new Date().toISOString().split('T')[0]}.csv`);
}


// ═══════════════════════════════════════════════════════════════
// CAAT EXPORT — Compensation Adjustment Admin Tool upload file
// ═══════════════════════════════════════════════════════════════

/** Stored ArrayBuffer of the uploaded blank CAAT template */
let caatTemplateBuffer = null;

/** Load and store the blank CAAT template uploaded by the user */
function loadCaatTemplate(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        caatTemplateBuffer = e.target.result;
        document.getElementById('caatTemplateLabel').textContent = `✔ ${file.name}`;
    };
    reader.readAsArrayBuffer(file);
}

/** Format a date string as DD-Mon-YYYY (CAAT required format). */
function formatCaatDate(dateStr) {
    if (!dateStr) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = new Date(dateStr + 'T12:00:00');
    return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

/** Return the first day of the month for a YYYY-MM-DD string. */
function firstOfMonth(dateStr) {
    return dateStr ? dateStr.slice(0, 7) + '-01' : '';
}

/**
 * Generate and download a CAAT-format Excel upload file.
 * If a blank template has been uploaded, writes data into it (preserving
 * dropdowns and formatting). Otherwise generates a file from scratch.
 */
function downloadCAAT() {
    if (!tenureData.length) {
        return alert('No tenure calculation results found. Run Calculate Milestones first.');
    }

    const uploadRows = tenureData.filter(r => r.recommendation === 'TPR Needed' && r.proposedRate);
    if (!uploadRows.length) {
        return alert('No employees require a pay rate upload — all are already at or above their step rate.');
    }

    const today = new Date().toISOString().split('T')[0];
    const fname = `CAAT_COL_StepPlan_Upload_${today}.xlsx`;

    if (caatTemplateBuffer && typeof XLSX !== 'undefined') {
        // ── Template-based export (preserves dropdowns & formatting) ──
        const wb = XLSX.read(caatTemplateBuffer, { type: 'array' });
        const ws = wb.Sheets['Transaction_Input_File'];
        if (!ws) return alert('Template does not contain a "Transaction_Input_File" sheet.');

        // Data starts at row 4 (0-indexed row 3)
        // Columns: A=ROW_ID(pre-filled), B=Status(blank), C=EmployeeID, D=Freq, E=CurrentRate, F=NewRate, G=Currency, H=EffDate, I=Reason
        uploadRows.forEach((r, i) => {
            const row = i + 4; // Excel rows 4, 5, 6...
            XLSX.utils.sheet_add_aoa(ws, [[
                '',                                                              // B - Status (blank)
                r.employeeId,                                                    // C - Employee ID
                'Annual',                                                        // D - Comp Frequency
                r.currentSalary,                                                 // E - Current Pay Rate
                r.proposedRate,                                                  // F - New Pay Rate
                'COP - Colombian Peso',                                          // G - Currency
                formatCaatDate(firstOfMonth(r.milestoneDate)),                   // H - Effective Date
                r.step === 'Mo6' ? '6RW - 6 month review' : 'ANN - Annual Review' // I - Reason
            ]], { origin: { r: row - 1, c: 1 } });
        });

        XLSX.writeFile(wb, fname);

    } else {
        // ── Fallback: generate from scratch ──
        if (!caatTemplateBuffer) {
            const proceed = confirm('No CAAT template uploaded. Export without template (dropdowns will not be included)?\n\nTo include dropdowns, upload the blank template using the "⬆ CAAT Template" button first.');
            if (!proceed) return;
        }

        const ROW1 = [
            '',
            '',
            '{"fieldCode":"employeeId","transactionCodes":["CAAT10001"],"excelTemplateColumnType":"TEXT"}',
            '{"fieldCode":"compFrequency","transactionCodes":["CAAT10001"],"excelTemplateColumnType":"TEXT_WITH_DATASET"}',
            '{"fieldCode":"currentPayRate","transactionCodes":["CAAT10001"],"excelTemplateColumnType":"TEXT"}',
            '{"fieldCode":"newPayRate","transactionCodes":["CAAT10001"],"excelTemplateColumnType":"TEXT"}',
            '{"fieldCode":"currencyCode","transactionCodes":["CAAT10001"],"excelTemplateColumnType":"TEXT_WITH_DATASET"}',
            '{"fieldCode":"effectiveDate","transactionCodes":["CAAT10001"],"excelTemplateColumnType":"DATE"}',
            '{"fieldCode":"reason","transactionCodes":["CAAT10001"],"excelTemplateColumnType":"TEXT_WITH_DATASET"}'
        ];
        const ROW2 = ['','Request Row Id','StatusColumnButNobodyReallyLooksAtIt','Employee ID','Comp Frequency','Current Pay Rate','New Pay Rate','Currency','Effective Date','Reason'];
        const ROW3 = [
            '',
            'This column is for reference purposes only',
            'For failed rows, scroll to the last column to view the failure reasons',
            'This column is required for this form. The Employee ID of the person who is being addressed.',
            'This column is required for this form. ',
            'This column is required for this form. ',
            'This column is required for this form. ',
            'This column is required for this form. ',
            'This column is required for this form. Please enter the date in the format DD-Mon-YYYY. Example: 05-Jul-1994.',
            'This column is required for this form. '
        ];

        const dataRows = uploadRows.map((r, i) => [
            '',
            i + 1,
            '',
            r.employeeId,
            'Annual',
            r.currentSalary,
            r.proposedRate,
            'COP - Colombian Peso',
            formatCaatDate(firstOfMonth(r.milestoneDate)),
            r.step === 'Mo6' ? '6RW - 6 month review' : 'ANN - Annual Review'
        ]);

        const wsData = [ROW1, ROW2, ROW3, ...dataRows];

        if (typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = [{wch:4},{wch:22},{wch:40},{wch:40},{wch:22},{wch:22},{wch:22},{wch:26},{wch:18},{wch:28}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Transaction_Input_File');
            XLSX.writeFile(wb, fname);
        } else {
            const csv = wsData.map(row =>
                row.map(c => { const s = String(c ?? ''); return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g,'""')}"` : s; }).join(',')
            ).join('\r\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fname.replace('.xlsx', '.csv');
            a.click();
            URL.revokeObjectURL(a.href);
        }
    }
}


// ═══════════════════════════════════════════════════════════════
// TAB 2 – Single Employee Quick Lookup
// ═══════════════════════════════════════════════════════════════

function singleLookup() {
    const hireDate     = document.getElementById('singleHireDate').value;
    const tempDate     = document.getElementById('singleTempDate').value;
    const refDate      = document.getElementById('singleRefDate').value;
    const currentSal   = parseFloat(document.getElementById('singleSalary').value) || 0;
    const shiftCode    = document.getElementById('singleShift').value.trim();
    const fpt          = document.getElementById('singleFPT').value;
    const empId        = document.getElementById('singleEmpId').value.trim() || '—';

    if (!hireDate)  return alert('Please enter a Last Hire Date.');
    if (!refDate)   return alert('Please enter an As-of Date.');
    if (!shiftCode) return alert('Please enter a Shift Code.');

    const origin       = getTenureOrigin(hireDate, tempDate);
    const tenureMonths = calcCompletedMonths(origin, refDate);
    const step         = getStep(tenureMonths);
    const language     = getLanguage(shiftCode);
    const proposedRate = getProposedRate(language, fpt, step);
    const { diff, recommendation } = getRecommendation(proposedRate, currentSal);
    const comment      = getComment({
        proposedRate, currentRate: currentSal, diff,
        tenureMonths, step, hireDate, refDate, language
    });

    const diffClass = diff > 0 ? 'diff-positive' : diff < 0 ? 'diff-negative' : '';
    const recoBadge = `<span class="reco-badge reco-${recommendation.replace(' ','-').toLowerCase()}">${recommendation}</span>`;
    const commBadge = `<span class="comment-badge comment-${commentClass(comment)}">${comment}</span>`;

    document.getElementById('singleResult').innerHTML = `
        <div class="single-result-grid">
            <div><strong>Employee ID</strong><span>${empId}</span></div>
            <div><strong>Tenure Origin</strong><span>${origin}${tempDate && tempDate < hireDate ? ' <span class="temp-badge">TEMP</span>' : ''}</span></div>
            <div><strong>As-of Date</strong><span>${refDate}</span></div>
            <div><strong>Tenure</strong><span>${tenureMonths} completed months</span></div>
            <div><strong>Step</strong><span><span class="step-badge">${step}</span></span></div>
            <div><strong>Language</strong><span><span class="lang-badge lang-${language.toLowerCase()}">${language}</span></span></div>
            <div><strong>Current Salary</strong><span>${fmtNum(currentSal)} COP</span></div>
            <div><strong>Proposed Rate</strong><span>${proposedRate ? fmtNum(proposedRate) + ' COP' : '—'}</span></div>
            <div><strong>Difference</strong><span class="${diffClass}">${diff !== null ? fmtNum(diff) + ' COP' : '—'}</span></div>
            <div><strong>Recommendation</strong><span>${recoBadge}</span></div>
            <div><strong>Comments</strong><span>${commBadge}</span></div>
        </div>
    `;
    document.getElementById('singleResult').classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════════
// TAB 3 – Terminated Employees
// ═══════════════════════════════════════════════════════════════

function processTerminated() {
    const text    = document.getElementById('termPasteData').value.trim();
    const fromVal = document.getElementById('termFromDate').value;
    const toVal   = document.getElementById('termToDate').value;

    if (!text)    return alert('Please upload or paste terminated employee data.');
    if (!fromVal || !toVal) return alert('Please select a termination date range.');

    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const from = new Date(fromVal);
    const to   = new Date(toVal);

    if (from < threeYearsAgo) {
        alert('Note: Records are available up to 3 years back. Displaying records from ' + threeYearsAgo.toISOString().split('T')[0] + ' onwards.');
    }

    const allRecords = parseTerminatedCSV(text);

    // Eligibility: Job Code P02241 + Location VCCC or 4463
    const ELIGIBLE_JOB_CODES = ['P02241'];
    const ELIGIBLE_LOCATIONS = ['VCCC', '4463', 'VCC'];

    terminatedData = allRecords
        .filter(r => {
            const termDate = new Date(r.terminationDate);
            return termDate >= from && termDate <= to && termDate >= threeYearsAgo;
        })
        .map(r => {
            const tenureAtTerm = calcCompletedMonths(r.hireDate, r.terminationDate);
            const language     = getLanguage(r.shiftCode || '', r.businessTitle);

            // Scope eligibility
            const jobEligible  = ELIGIBLE_JOB_CODES.includes(r.jobCode.trim().toUpperCase());
            const locEligible  = ELIGIBLE_LOCATIONS.some(l => r.locationCode.toUpperCase().includes(l));
            const inScope      = jobEligible && locEligible;

            // Milestone eligibility: would this employee have hit a milestone within the date range?
            let milestoneInRange  = null;
            let milestoneDateStr  = '';
            let stepAtMilestone   = '';
            let proposedRate      = null;

            if (inScope && r.hireDate) {
                const hits = getMilestonesInRange(r.hireDate, fromVal, toVal);
                if (hits.length > 0) {
                    // Take the earliest milestone in range
                    hits.sort((a, b) => a.milestoneDate - b.milestoneDate);
                    milestoneInRange = hits[0];
                    milestoneDateStr = milestoneInRange.milestoneDate.toISOString().split('T')[0];
                    stepAtMilestone  = milestoneInRange.step;
                    proposedRate     = getProposedRate(language, r.fpt, stepAtMilestone);
                }
            }

            const hadMilestone   = milestoneInRange !== null;
            const eligibleIncrease = inScope && hadMilestone;

            return {
                ...r,
                tenureAtTerm,
                language,
                inScope,
                hadMilestone,
                eligibleIncrease,
                milestoneStep:  stepAtMilestone,
                milestoneDate:  milestoneDateStr,
                proposedRate
            };
        });

    renderTerminatedTable(terminatedData);
    document.getElementById('terminatedResults').classList.remove('hidden');
    document.getElementById('termFilters').style.display = 'flex';
}

function filterTerminatedTable() {
    const empFilter = document.getElementById('termEmpIdFilter').value.trim();
    const empIds    = empFilter ? empFilter.split(',').map(e => e.trim().toUpperCase()) : [];
    const filtered  = empIds.length
        ? terminatedData.filter(r => empIds.includes(r.employeeId.toUpperCase()))
        : terminatedData;
    renderTerminatedTable(filtered);
}

function renderTerminatedTable(rows) {
    const inScope          = rows.filter(r => r.inScope).length;
    const eligibleIncrease = rows.filter(r => r.eligibleIncrease).length;

    document.getElementById('termSummary').innerHTML = `
        <div class="summary-grid">
            <div class="stat"><span class="stat-value">${rows.length}</span><span class="stat-label">Terminated Employees</span></div>
            <div class="stat"><span class="stat-value">${inScope}</span><span class="stat-label">In Scope (P02241 · VCC)</span></div>
            <div class="stat upload"><span class="stat-value">${eligibleIncrease}</span><span class="stat-label">Had Eligible Milestone in Range</span></div>
        </div>
    `;

    if (!rows.length) {
        document.getElementById('termTableContainer').innerHTML = '<p class="no-data">No termination records found for the selected date range.</p>';
        return;
    }

    let html = `<table><thead><tr>
        <th>Employee ID</th><th>Name</th><th>Last Hire Date</th>
        <th>Termination Date</th><th>Tenure at Term (Mo)</th>
        <th>Job Code</th><th>Location</th><th>Language</th><th>F/P</th>
        <th>In Scope</th><th>Milestone in Range</th><th>Milestone Date</th>
        <th>Proposed Rate (COP)</th><th>Final Salary (COP)</th>
    </tr></thead><tbody>`;

    rows.forEach(r => {
        const scopeBadge = r.inScope
            ? '<span class="reco-badge reco-upload">Yes</span>'
            : '<span class="reco-badge reco-no-action">No</span>';
        const milestoneBadge = r.eligibleIncrease
            ? `<span class="step-badge">${r.milestoneStep}</span>`
            : r.inScope ? '<span class="comment-badge">None</span>' : '—';
        const langBadge = r.language !== 'Unknown'
            ? `<span class="lang-badge lang-${r.language.toLowerCase()}">${r.language}</span>`
            : '<span class="lang-badge lang-unknown">Unknown</span>';

        html += `<tr>
            <td>${r.employeeId}</td>
            <td>${r.name}</td>
            <td>${r.hireDate}</td>
            <td>${r.terminationDate}</td>
            <td class="num">${r.tenureAtTerm ?? calcCompletedMonths(r.hireDate, r.terminationDate)}</td>
            <td>${r.jobCode}</td>
            <td>${r.locationCode}</td>
            <td>${langBadge}</td>
            <td>${r.fpt || '—'}</td>
            <td>${scopeBadge}</td>
            <td>${milestoneBadge}</td>
            <td>${r.milestoneDate || '—'}</td>
            <td class="num">${r.proposedRate ? fmtNum(r.proposedRate) : '—'}</td>
            <td class="num">${fmtNum(r.finalSalary)}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('termTableContainer').innerHTML = html;
}

function downloadTerminatedCSV() {
    const rows = terminatedData.map(r => ({
        employee_id:                    r.employeeId,
        name:                           r.name,
        last_hire_date:                 r.hireDate,
        termination_date:               r.terminationDate,
        tenure_at_termination_months:   r.tenureAtTerm ?? calcCompletedMonths(r.hireDate, r.terminationDate),
        job_code:                       r.jobCode,
        location_code:                  r.locationCode,
        language:                       r.language || '',
        full_part_time:                 r.fpt || '',
        in_scope:                       r.inScope ? 'Yes' : 'No',
        milestone_in_range:             r.milestoneStep || '',
        milestone_date:                 r.milestoneDate || '',
        proposed_rate:                  r.proposedRate ?? '',
        final_salary:                   r.finalSalary,
        eligible_for_increase:          r.eligibleIncrease ? 'Yes' : 'No'
    }));
    downloadCSV(rows, `col_cs_terminated_${new Date().toISOString().split('T')[0]}.csv`);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('popCalcDate').value    = today;
    document.getElementById('tenureEndDate').value  = today;
    document.getElementById('singleRefDate').value  = today;
    document.getElementById('termToDate').value     = today;
});
