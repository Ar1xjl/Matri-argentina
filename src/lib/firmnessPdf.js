import { jsPDF } from 'jspdf'
import { lossRate } from './firmness'
import wassingtonLogoUrl from '../assets/logos/wassington_agro_logo.png'
import matriWordmarkUrl from '../assets/logos/matri_wordmark.png'

// Colors sampled directly from the real signed "Declaración jurada" Wassington
// issues (Testigo = pastel green, Matri = orange, dividers = olive green) —
// matched to that document's own branding, not the portal's navy/coral theme,
// since this is meant to read as the same familiar report.
const GREEN_TESTIGO = [201, 237, 193]
const ORANGE_MATRI = [255, 153, 0]
const OLIVE_DIVIDER = [79, 97, 40]
const BAND_BG = [232, 243, 220]
const BORDER = [90, 90, 90]

const FIELD_LABELS = {
  declaration_number: 'Declaración jurada N°', variety: 'Variedad', lot_number: 'Lote',
  cold_type: 'Tipo de frío', harvest_date: 'Fecha de cosecha',
  room_fill_start: 'Inicio de llenado de cámara', room_fill_end: 'Final de llenado de cámara',
  room_exit_date: 'Fecha de salida de cámara', evaluator_name: 'Evaluador',
}
const DATE_FIELDS = new Set(['harvest_date', 'room_fill_start', 'room_fill_end', 'room_exit_date'])

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function fieldRow(doc, x, y, w, label, value) {
  const h = 20
  doc.setDrawColor(...BORDER)
  doc.rect(x, y, w, h)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(60)
  doc.text(label, x + 6, y + 13)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(20)
  doc.text(String(value), x + w * 0.55, y + 13)
  return h
}

function sectionDivider(doc, x, y, w, label) {
  const h = 16
  doc.setFillColor(...OLIVE_DIVIDER)
  doc.rect(x, y, w, h, 'F')
  if (label) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255)
    doc.text(label, x + 6, y + 11)
  }
  return h
}

// Generates a formatted "Declaración jurada"-style report client-side from
// the structured fields/samples — always available, independent of whether
// Wassington also attached the original signed PDF (see firmness_evaluations
// migration 0020's `pdf_url`, a separate, optional artifact). Visually
// modeled on the real signed document Wassington issues per room/application,
// down to its letterhead and chart colors.
export async function generateFirmnessPdf(treatment, evaluation) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 44
  const contentW = pageW - margin * 2
  let y = 0

  // Letterhead — composed dynamically from the two brand marks (Wassington's
  // own logo, extracted from their .ai file, and the generic MaTri wordmark
  // cropped out of the product-logo SVG) plus a season year derived from
  // this evaluation's own harvest date, rather than a static banner image
  // with a baked-in year that would need manual replacement every season.
  const bandH = 90
  doc.setFillColor(...BAND_BG)
  doc.rect(margin, y, contentW, bandH, 'F')

  try {
    const [wassingtonLogo, matriWordmark] = await Promise.all([loadImage(wassingtonLogoUrl), loadImage(matriWordmarkUrl)])

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 90, 40)
    doc.text('Calidad y Sanidad en Post-Cosecha', margin + 14, y + 18)

    const wLogoH = 34
    const wLogoW = wLogoH * (wassingtonLogo.width / wassingtonLogo.height)
    doc.addImage(wassingtonLogo, 'PNG', margin + 14, y + 26, wLogoW, wLogoH)

    // Year + MaTri wordmark sit to the RIGHT of the Wassington logo, not
    // stacked under it — both anchored to the band's bottom edge.
    const groupX = margin + 14 + wLogoW + 26
    const season = evaluation.harvest_date ? new Date(evaluation.harvest_date).getFullYear() : new Date().getFullYear()
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(...OLIVE_DIVIDER)
    doc.text(String(season), groupX, y + bandH - 20)

    const mWordH = 30
    const mWordW = mWordH * (matriWordmark.width / matriWordmark.height)
    doc.addImage(matriWordmark, 'PNG', groupX + doc.getTextWidth(String(season)) + 10, y + bandH - 20 - mWordH + 7, mWordW, mWordH)
  } catch {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20)
    doc.text('WASSINGTON — MaTri', margin + 14, y + bandH / 2)
  }
  y += bandH + 14

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20)
  doc.text(`Tratamiento #${treatment.id.slice(0, 8)} · ${treatment.organizations?.name || ''} · Cámara ${treatment.cold_rooms?.name || ''}`, margin, y)
  y += 16

  // Identification fields — bordered rows, same shape as the real form.
  const fieldEntries = Object.entries(FIELD_LABELS)
    .map(([key, label]) => [label, key, evaluation[key]])
    .filter(([, , value]) => value)
  fieldEntries.forEach(([label, key, value]) => {
    const display = DATE_FIELDS.has(key) ? new Date(value).toLocaleDateString('es-AR') : value
    y += fieldRow(doc, margin, y, contentW, label, display)
  })
  y += 10

  // Samples table
  const samples = evaluation.samples || []
  y += sectionDivider(doc, margin, y, contentW, 'EVALUACIÓN DE FIRMEZA')
  y += 4

  const labelColW = contentW * 0.22
  const dayColW = (contentW - labelColW - contentW * 0.18) / Math.max(samples.length, 1)
  const lossColW = contentW * 0.18

  const headerH = 26
  doc.setFillColor(...GREEN_TESTIGO)
  doc.rect(margin, y, contentW, headerH, 'F')
  doc.setDrawColor(...BORDER)
  doc.rect(margin, y, contentW, headerH)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(20)
  doc.text('Tratamiento', margin + 6, y + 16)
  samples.forEach((s, i) => doc.text(`Día ${s.day}`, margin + labelColW + dayColW * i + dayColW / 2, y + 16, { align: 'center' }))
  doc.text('Pérdida (lb/pulg²/día)', margin + labelColW + dayColW * samples.length + 4, y + 11)
  doc.text('desde día 1–14', margin + labelColW + dayColW * samples.length + 4, y + 21)
  y += headerH

  const loss = lossRate(samples)
  const dataRow = (label, key, lossVal, color) => {
    const rowH = 22
    doc.setDrawColor(...BORDER)
    doc.rect(margin, y, contentW, rowH)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...color)
    doc.text(label, margin + 6, y + 15)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20)
    samples.forEach((s, i) => doc.text(s[key] != null ? String(s[key]) : '—', margin + labelColW + dayColW * i + dayColW / 2, y + 15, { align: 'center' }))
    doc.text(lossVal != null ? lossVal.toFixed(2) : '—', margin + labelColW + dayColW * samples.length + lossColW / 2, y + 15, { align: 'center' })
    y += rowH
  }
  dataRow('Testigo', 'testigo', loss.testigo, [180, 90, 60])
  dataRow('Matri', 'matri', loss.matri, [11, 67, 88])
  y += 26

  // Bar chart — grouped bars per day, same color/legend convention as the
  // real document (Testigo pastel green, Matri orange).
  const rows = samples.filter(s => s.day != null && s.testigo != null && s.matri != null)
  if (rows.length >= 1) {
    const sorted = [...rows].sort((a, b) => a.day - b.day)
    const chartH = 210, padL = 34, padB = 22, padT = 20
    const x0 = margin, y0 = y
    const maxVal = Math.max(...sorted.map(s => Math.max(s.testigo, s.matri))) * 1.15 || 1
    const groupW = (contentW - padL - 10) / sorted.length
    const barW = groupW * 0.28

    // legend
    doc.setFillColor(...GREEN_TESTIGO); doc.rect(x0 + padL, y0, 9, 9, 'F')
    doc.setFontSize(9); doc.setTextColor(20)
    doc.text('Testigo', x0 + padL + 13, y0 + 8)
    doc.setFillColor(...ORANGE_MATRI); doc.rect(x0 + padL + 70, y0, 9, 9, 'F')
    doc.text('Matri', x0 + padL + 83, y0 + 8)

    doc.setDrawColor(180)
    doc.line(x0 + padL, y0 + chartH - padB, x0 + contentW - 4, y0 + chartH - padB)
    doc.line(x0 + padL, y0 + padT, x0 + padL, y0 + chartH - padB)

    sorted.forEach((s, i) => {
      const groupX = x0 + padL + groupW * i + groupW / 2
      const hTestigo = (chartH - padB - padT) * (s.testigo / maxVal)
      const hMatri = (chartH - padB - padT) * (s.matri / maxVal)
      doc.setFillColor(...GREEN_TESTIGO)
      doc.rect(groupX - barW - 2, y0 + chartH - padB - hTestigo, barW, hTestigo, 'F')
      doc.setFillColor(...ORANGE_MATRI)
      doc.rect(groupX + 2, y0 + chartH - padB - hMatri, barW, hMatri, 'F')
      doc.setFontSize(9); doc.setTextColor(80)
      doc.text(String(s.day), groupX, y0 + chartH - padB + 13, { align: 'center' })
    })

    doc.setFontSize(8.5); doc.setTextColor(100)
    doc.text('Días a temperatura ambiente', x0 + contentW / 2, y0 + chartH + 2, { align: 'center' })
    y += chartH + 20
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20)
  doc.text(`Evaluador: ${evaluation.evaluator_name || '—'}`, margin, y)
  y += 26

  doc.setTextColor(150); doc.setFontSize(8)
  doc.text(`Generado por el portal MaTri el ${new Date().toLocaleDateString('es-AR')}`, margin, doc.internal.pageSize.getHeight() - 26)

  doc.save(`evaluacion-firmeza-${treatment.id.slice(0, 8)}.pdf`)
}
