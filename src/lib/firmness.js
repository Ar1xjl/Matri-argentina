// Firmness Evaluation helpers — loss rate is always derived from `samples`,
// never stored, same as every other computed figure in this app (dosing.js).

export const DEFAULT_SAMPLES = [
  { day: 1, testigo: '', matri: '' },
  { day: 7, testigo: '', matri: '' },
  { day: 14, testigo: '', matri: '' },
]

// (lb/pulg²/día) lost between the first and last sampled day, per treatment.
export function lossRate(samples) {
  const rows = (samples || []).filter(s => s.day != null && s.testigo !== '' && s.matri !== '')
  if (rows.length < 2) return { testigo: null, matri: null }
  const sorted = [...rows].sort((a, b) => a.day - b.day)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const days = last.day - first.day
  if (!days) return { testigo: null, matri: null }
  return {
    testigo: (Number(first.testigo) - Number(last.testigo)) / days,
    matri: (Number(first.matri) - Number(last.matri)) / days,
  }
}
