// Crop suggestions for Cold Room forms (Rooms.jsx, Calculator.jsx's inline
// "new room"). These are presented via <datalist> as suggestions only — the
// input always accepts free text too, so a crop missing from this list
// doesn't block anyone. Mirrors the crop lineup in the DoseRight calculator
// (1mcp-dose-calculator.html), translated to the Spanish terms used in the
// Argentine market, so the two tools stay conceptually in sync without
// forcing the exact same list to be hand-maintained in three languages.
export const CROP_OPTIONS = [
  'Manzana',
  'Pera',
  'Palta',
  'Mango',
  'Kiwi',
  'Banana',
  'Durazno',
  'Tomate',
  'Lima',
  'Melón',
  'Sandía',
  'Caqui',
  'Ciruela',
]
