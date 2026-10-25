// Shared Excel export toolkit (exceljs, lazy-loaded — the ~1MB library only
// downloads when a teacher actually clicks an Export button).
//
// One visual language for every export: a title block (what / who / when),
// a bold frozen header row, thin borders, fitted columns, and status colors
// (green = graded, amber = to grade, red = missing) — the same semantics the
// app's gradebook already uses.

let exceljsPromise = null;

export async function getExcelJS() {
    if (!exceljsPromise) {
        exceljsPromise = import('exceljs').then((m) => m.default ?? m);
    }
    return exceljsPromise;
}

export const XL = {
    headerFill: 'FF0071E3', // iOS blue — matches the dashboard accent
    activityHeaderFill: 'FF475569', // slate — distinguishes activity columns from quiz columns
    headerFont: { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 },
    titleFont: { bold: true, size: 15, color: { argb: 'FF111827' } },
    subFont: { size: 10.5, color: { argb: 'FF6B7280' } },
    border: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    gradedFill: 'FFE8F6EF', gradedFont: { color: { argb: 'FF065F46' } },
    pendingFill: 'FFFEF6E0', pendingFont: { color: { argb: 'FF92610A' }, bold: true },
    missingFill: 'FFFDE7E7', missingFont: { color: { argb: 'FF991B1B' }, bold: true },
    mutedFont: { color: { argb: 'FF9CA3AF' } },
    avgFill: 'FFF3F4F6',
    avgFont: { bold: true, color: { argb: 'FF374151' } },
};

export function allBorders(cell) {
    cell.border = { top: XL.border, left: XL.border, bottom: XL.border, right: XL.border };
}

/**
 * Rows 1-3: big title, subtitle line, and an empty spacer. Returns the row
 * number the table header should land on (4).
 */
export function addTitleBlock(ws, title, subtitle, colCount) {
    const width = Math.max(colCount, 4);
    ws.mergeCells(1, 1, 1, width);
    const t = ws.getCell(1, 1);
    t.value = title;
    t.font = XL.titleFont;
    t.alignment = { vertical: 'middle' };
    ws.getRow(1).height = 26;

    ws.mergeCells(2, 1, 2, width);
    const s = ws.getCell(2, 1);
    s.value = subtitle;
    s.font = XL.subFont;
    ws.getRow(2).height = 16;

    return 4;
}

/** Bold blue frozen header row with borders + wrap. */
export function styleHeader(ws, rowIndex, colCount) {
    const row = ws.getRow(rowIndex);
    row.height = 28;
    for (let c = 1; c <= colCount; c += 1) {
        const cell = ws.getCell(rowIndex, c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.headerFill } };
        cell.font = XL.headerFont;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        allBorders(cell);
    }
    // Freeze everything above the header row and left of the student-name
    // column (the first columns scroll away, the names stay put)
    ws.views = [{ state: 'frozen', ySplit: rowIndex }];
}

/** Fit every column to its content (caps included so long titles wrap). */
export function fitColumns(ws, colCount, { min = 8, max = 46, wrapCols = [] }) {
    for (let c = 1; c <= colCount; c += 1) {
        let longest = min;
        ws.getColumn(c).eachCell({ includeEmpty: false }, (cell) => {
            const text = cell.value === null || cell.value === undefined ? '' : String(cell.value);
            // Rough width of a wrapped cell: longest single line
            const lines = text.split('\n');
            const line = Math.max(...lines.map((l) => l.length), 0);
            if (line > longest) longest = line;
        });
        const capped = Math.min(longest + 3, wrapCols.includes(c) ? max : max);
        ws.getColumn(c).width = capped;
    }
}

export function stamp() {
    const d = new Date();
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function stampFile() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function fmtDuration(seconds) {
    if (seconds === null || seconds === undefined) return '';
    const s = Math.max(0, Math.round(Number(seconds)));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Write the workbook to a browser download. */
export async function downloadWorkbook(workbook, filename) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}
