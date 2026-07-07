import * as XLSX from 'xlsx'

// One consolidated template: Frigorífico + Cámara + Volumen + Dosis + Fecha.
// Product is deliberately not a column here — after upload, the customer
// selects multiple rows in the table and applies a product to all of them
// at once (bulk action), rather than typing it per row in Excel.
export function downloadPlanTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet([
    {
      'Frigorífico': 'Est. San José',
      'Cámara': 'Cámara Norte 1',
      'Volumen (m³)': 500,
      'Dosis (ppb)': 1000,
      'Fecha (DD/MM/AAAA)': '15/03/2026',
    },
  ])
  XLSX.utils.book_append_sheet(wb, ws, 'Plan')
  XLSX.writeFile(wb, 'plantilla_plan_temporada.xlsx')
}

// ── File parsing ────────────────────────────────────────────────────────────

function readSheet(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        // cellDates: true — if the customer's spreadsheet has real Excel date
        // cells (not just text), they arrive as JS Date objects instead of
        // ambiguous serial numbers or locale-dependent strings.
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }))
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

// Always interpreted as DD/MM/AAAA (Argentine format) — never handed to
// `new Date(string)`, which assumes US MM/DD and silently misreads dates
// like 03/04/2026 (3rd of April here, but "March 4th" to a US parser).
function parseArgDate(value) {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10)
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return undefined
  const [, dd, mm, yyyy] = match
  const day = Number(dd), month = Number(mm)
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
  return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Valid rows import as-is; invalid rows are skipped and reported so the
// customer can fix and re-upload just those, instead of the whole file
// being rejected. Rows with only Frigorífico/Cámara/Volumen (no dose or
// date yet) are valid too — that's just registering the room.
export async function parsePlanFile(file) {
  const rows = await readSheet(file)
  const valid = []
  const errors = []
  rows.forEach((row, i) => {
    const roomName = String(row['Cámara'] || '').trim()
    if (!roomName) { errors.push({ row: i + 2, reason: 'Falta el nombre de la cámara' }); return }

    const dateRaw = row['Fecha (DD/MM/AAAA)']
    const plannedDate = parseArgDate(dateRaw)
    if (plannedDate === undefined) { errors.push({ row: i + 2, reason: `Fecha inválida: "${dateRaw}" — usá el formato DD/MM/AAAA` }); return }

    const doseRaw = row['Dosis (ppb)']
    const dose = doseRaw ? Number(doseRaw) : null
    if (doseRaw && (!dose || dose <= 0)) { errors.push({ row: i + 2, reason: `Dosis inválida: "${doseRaw}"` }); return }

    const roomVolume = Number(row['Volumen (m³)']) || null

    valid.push({
      roomName,
      roomVolume,
      location: String(row['Frigorífico'] || '').trim() || null,
      planned_date: plannedDate,
      planned_dose_ppb: dose,
    })
  })
  return { valid, errors }
}
