import * as XLSX from 'xlsx'

// Shared "any table in the app → Excel" export, and per-column text filtering.
// columns: [{ header: string, get: (row) => string|number }]

export function exportToExcel(filename, columns, rows) {
  const data = rows.map(row => {
    const obj = {}
    columns.forEach(c => { obj[c.header] = c.get(row) ?? '' })
    return obj
  })
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, filename)
}

// filters: { [header]: searchString } — case-insensitive substring match
// against each column's plain value, same accessor used for export.
export function filterRows(rows, columns, filters) {
  const active = Object.entries(filters).filter(([, v]) => v)
  if (active.length === 0) return rows
  return rows.filter(row =>
    active.every(([header, needle]) => {
      const col = columns.find(c => c.header === header)
      if (!col) return true
      return String(col.get(row) ?? '').toLowerCase().includes(needle.toLowerCase())
    })
  )
}
