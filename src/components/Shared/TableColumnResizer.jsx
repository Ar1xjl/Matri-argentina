import { useEffect } from 'react'

// Adds drag-to-resize handles to the header of every table inside a
// `.table-scroll` wrapper, app-wide, without touching each table's own JSX:
// a MutationObserver injects a handle into each first-row <th>. Dragging one
// freezes the table to explicit pixel widths (table-layout: fixed) so the
// change sticks; double-clicking a handle drops back to automatic layout.
// Widths are remembered per browser, keyed by the table's header labels.

const STORAGE_KEY = 'matri.columnWidths.v1'
const MIN_WIDTH = 44

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
function saveTable(key, widths) {
  try {
    const all = loadAll()
    if (widths) all[key] = widths; else delete all[key]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch { /* storage unavailable — resizing still works for this session */ }
}

const headerRow = (table) => table.tHead?.rows[0] || null
const labelOf = (th) => (th.textContent || '').trim()

function eligible(table) {
  const row = headerRow(table)
  if (!row || row.cells.length === 0) return false
  return Array.from(row.cells).every(th => th.colSpan <= 1)
}

function tableKey(table) {
  return Array.from(headerRow(table).cells).map(labelOf).join('|')
}

function applyWidths(table, widths) {
  const row = headerRow(table)
  const cols = table.querySelectorAll(':scope > colgroup > col')
  let total = 0
  Array.from(row.cells).forEach((th, i) => {
    const w = Math.max(MIN_WIDTH, Math.round(widths[i]))
    total += w
    th.style.boxSizing = 'border-box'
    th.style.width = w + 'px'
    if (cols[i]) { cols[i].style.width = w + 'px'; cols[i].style.minWidth = w + 'px' }
  })
  table.style.tableLayout = 'fixed'
  table.style.width = total + 'px'
  table.classList.add('rz-fixed')
}

function resetTable(table) {
  const row = headerRow(table)
  Array.from(row.cells).forEach(th => { th.style.width = ''; th.style.boxSizing = '' })
  table.querySelectorAll(':scope > colgroup > col').forEach(c => { c.style.width = ''; c.style.minWidth = '' })
  table.style.tableLayout = ''
  table.style.width = ''
  table.classList.remove('rz-fixed')
  saveTable(tableKey(table), null)
}

function startDrag(e, table, index) {
  e.preventDefault()
  e.stopPropagation()
  const row = headerRow(table)
  const widths = Array.from(row.cells).map(th => th.getBoundingClientRect().width)
  if (!table.classList.contains('rz-fixed')) applyWidths(table, widths)
  const startX = e.clientX
  const startW = widths[index]
  const handle = e.currentTarget
  handle.setPointerCapture?.(e.pointerId)
  handle.classList.add('active')

  const onMove = (ev) => {
    widths[index] = Math.max(MIN_WIDTH, startW + (ev.clientX - startX))
    applyWidths(table, widths)
  }
  const onUp = () => {
    handle.classList.remove('active')
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onUp)
    handle.removeEventListener('pointercancel', onUp)
    saveTable(tableKey(table), widths.map(Math.round))
  }
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onUp)
  handle.addEventListener('pointercancel', onUp)
}

function enhance(table) {
  if (!eligible(table)) return
  const row = headerRow(table)
  const cells = Array.from(row.cells)

  if (!table.dataset.rzRestored) {
    table.dataset.rzRestored = '1'
    const saved = loadAll()[tableKey(table)]
    if (Array.isArray(saved) && saved.length === cells.length) applyWidths(table, saved)
  }

  cells.forEach((th, i) => {
    if (th.querySelector(':scope > .col-rz-handle')) return
    if (getComputedStyle(th).position === 'static') th.style.position = 'relative'
    const handle = document.createElement('span')
    handle.className = 'col-rz-handle'
    handle.title = 'Arrastrá para ajustar el ancho · doble clic para restablecer'
    handle.addEventListener('pointerdown', (e) => startDrag(e, table, i))
    handle.addEventListener('dblclick', (e) => { e.stopPropagation(); resetTable(table) })
    handle.addEventListener('click', (e) => e.stopPropagation())
    th.appendChild(handle)
  })
}

export default function TableColumnResizer() {
  useEffect(() => {
    let frame = null
    const scan = () => {
      frame = null
      document.querySelectorAll('.table-scroll table').forEach(enhance)
    }
    const schedule = () => { if (frame == null) frame = requestAnimationFrame(scan) }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    schedule()
    return () => { observer.disconnect(); if (frame != null) cancelAnimationFrame(frame) }
  }, [])
  return null
}
