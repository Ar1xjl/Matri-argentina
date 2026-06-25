# MaTri Argentina — DoseRight Calculator
## Project Knowledge Base · FreshInset
**Last updated:** June 2026  
**Status:** Calculator v1 complete · Portal prototype in project files · GitHub deployment in progress

---

## 1. Project Overview

FreshInset is building a **Spanish-language web portal** for Argentina that mirrors the US MaTri DoseRight Calculator (`https://ytbe.com/clients/_sites/ma-tri.com/`). The tool lets cold-storage operators calculate the exact dose of MaTri 1-MCP product (Powder or Tablets) for each room, shows the optimal packaging combination, calculates cost, and (future) issues orders.

**Phase 1 (current):** Standalone calculator — no backend, no authentication, no database. Single HTML file, deployable to GitHub Pages.  
**Phase 2 (planned):** Full portal with login, room management, order history, multi-room summaries.

---

## 2. Key Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Language | Spanish only | Argentina market |
| Product scope | Both Matri Powder + Matri Tablets | Both available in Argentina |
| Room size input | Volume in m³ only | Drives all dose calculations |
| Phase 1 backend | None — calculator only | Speed to market, get feedback first |
| Hosting | GitHub Pages | Free, user already has GitHub account |
| Design system | Match US portal exactly | Navy `#0b4358` / lime `#b5cc2e` / coral `#e8736a` / off-white `#f5f5ee` |
| Price model | Per-m³ at 1,000 ppb baseline, proportional scaling | Simple, transparent |
| Admin access | Embedded admin bar in same HTML | No backend needed for Phase 1 |

---

## 3. Product Specifications

### 3.1 Matri Powder
- **Active ingredient:** 1-Methylcyclopropene (1-MCP) at 3.3% concentration
- **Standard dose:** 0.067 g of 3.3% Matri Powder per m³ = 1,000 ppb
- **Dose formula:** `grams = volume_m3 × 0.067 × (target_ppb / 1000)`
- **Dose range:** 100–5,000 ppb (user-adjustable)
- **Available pouch sizes in Argentina:** 10g, 20g, 50g, 100g
- **Pouch selection algorithm:** Greedy descending (100 → 50 → 20 → 10g), ceiling rounding

### 3.2 Matri Tablets
- **Standard dose:** 1,000 ppb
- **Small tablet:** covers 2.5 m³
- **Large tablet:** covers 5 m³
- **Selection algorithm:** Max large tablets (floor(vol/5)), remainder covered by small tablets (ceil(rem/2.5))
- **Rationale for both sizes:** Fine-tuning coverage, minimizing excess

### 3.3 Pricing
- **Reference price:** $0.85 USD/m³ at 1,000 ppb (FreshInset-set)
- **Scaling:** Cost scales proportionally with ppb → `cost = vol × price_per_m3 × (actual_ppb / 1000)`
- **Admin-configurable:** Price + client name editable via embedded admin bar
- **This is a placeholder price** — FreshInset sets per-client pricing in real deployments

---

## 4. Completed Modules (Phase 1)

### ✅ 4.1 Matri Powder Calculator
- Volume input (m³) + optional room name
- Target dose input (ppb), default 1,000, with "reset to standard" button
- Greedy pouch combination (ceiling)
- **Dose adjustment flow** (key UX decision): when rounding excess > 1%, shows two options:
  - **Opción A:** Use extra pouch → exact target ppb, higher cost
  - **Opción B:** Drop extra pouch → lower ppb (shown explicitly), lower cost
  - User selects; confirmed banner shows final ppb + grams + cost summary
- Cost banner (dark navy): total USD, USD/m³, actual ppb delivered

### ✅ 4.2 Matri Tablets Calculator
- Volume input (m³) + optional room name
- Optimal large/small tablet combination
- Cost banner: total USD, USD/m³, total m³ covered
- Note showing excess coverage

### ✅ 4.3 Admin Panel (FreshInset)
- Hidden behind "Configurar precio" button in top bar
- Fields: base price ($/m³ at 1,000 ppb), client name
- Saves to JS runtime variable (resets on page reload — Phase 1 limitation)
- Client name propagates to header label

### ✅ 4.4 Design System (matches US portal)
```
--navy:      #0b4358   (headings, nav, metric values, cost banner bg)
--lime:      #b5cc2e   (hero banner, result card border, admin accent)
--coral:     #e8736a   (CTA buttons, pouch qty, Opción A)
--cream:     #f5f5ee   (page background, metric boxes)
--green:     #3b6d11   (Opción B / adjusted dose)
--white:     #fff      (cards)
Font: system-ui / -apple-system / Segoe UI (no external font dependency)
Icons: Tabler Icons webfont (CDN)
```

### ✅ 4.5 Standalone HTML File
- Single file: `matri-argentina-calculator.html` / `index.html`
- No build step, no dependencies except Tabler Icons CDN
- Mobile-responsive (grid collapses at 500px)
- Deliverable output: `/mnt/user-data/outputs/matri-argentina-calculator.html`

### ✅ 4.6 Full Portal Prototype (matri_argentina_portal.html — in project files)
A more complete multi-view prototype exists in project knowledge with:
- Landing page with product showcase
- Sign-in / register modal flow
- Authenticated portal with sidebar navigation
- Dashboard, Rooms, Orders, Calculator, Generators, Documents, App Log, Profile panels
- Session timer, tier badges (T1 Wassington / T2 Podlesh / T3+ distributors)
- Demo data for Kleppe S.A. (Tier 1 client)
- MaTri branding with real SVG logos embedded as base64

---

## 5. Architecture

```
matri-argentina-calculator.html  (Phase 1 — live)
│
├── Admin Bar (FreshInset only)
│   └── price_per_m3, client_name → JS runtime vars
│
├── Header (matri logo + client label)
├── Hero (lime banner + title)
│
├── Product Tabs
│   ├── [Matri Powder]
│   │   ├── Inputs: room name, volume (m³), dose (ppb)
│   │   ├── calcPowder() → greedyCeiling() + greedyFloor()
│   │   ├── Dose Choice Flow (if excess > 1%)
│   │   │   ├── Opción A: exactCombo → exact ppb + cost
│   │   │   └── Opción B: adjCombo → adjusted ppb + cost
│   │   └── Cost Banner → showCostBanner(totalG, vol, ppbReal)
│   │
│   └── [Matri Tablets]
│       ├── Inputs: room name, volume (m³)
│       ├── calcTablets() → floor/ceil algorithm
│       └── Cost Banner
│
└── Footer

Key JS vars:
  POUCHES = [100, 50, 20, 10]       // g, descending
  DOSE_BASE = 0.067                  // g/m³ at 1000ppb
  pricePerM3At1000 = 0.85           // USD, admin-configurable
  lastVol, lastPpb, lastGrams       // state for selectOption()
  exactCombo[], adjCombo[]           // pouch arrays for dose choice
```

---

## 6. Key Code Patterns

### Dose calculation
```javascript
lastGrams = volume_m3 × DOSE_BASE × (target_ppb / 1000)
// DOSE_BASE = 0.067 g/m³ at 1,000 ppb
```

### Pouch optimization (ceiling — never under-dose)
```javascript
function greedyCeiling(grams) {
  let rem = grams, r = [];
  for (const s of POUCHES) { const q = Math.floor(rem/s); r.push({size:s,qty:q}); rem -= q*s; }
  if (rem > 0.001) r[r.length-1].qty += 1;  // round up smallest
  return r;
}
```

### Pouch optimization (floor — for Opción B)
```javascript
function greedyFloor(grams) {
  // same but NO ceiling rounding — may under-dose slightly
}
```

### Actual ppb delivered from a combo
```javascript
function actualPpb(totalG, vol) { return (totalG / (vol * DOSE_BASE)) * 1000; }
```

### Cost calculation (proportional to ppb)
```javascript
function calcCost(vol, ppb) { return vol × pricePerM3At1000 × (ppb / 1000); }
```

### Dose choice trigger (show options only when excess is meaningful)
```javascript
const needsChoice = exactExcess > 1.0 && adjG > 0 && adjG !== exactG;
// adjG = greedyFloor result; exactG = greedyCeiling result
```

### Tablet algorithm
```javascript
const large = Math.floor(vol / 5);
const rem = vol - large * 5;
const small = Math.ceil(rem / 2.5);
```

### Number formatting (Argentine locale)
```javascript
function fmtUSD(v) { return '$' + v.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtNum(v, d=1) { return v.toLocaleString('es-AR', {minimumFractionDigits:d, maximumFractionDigits:d}); }
```

---

## 7. Deployment

### Current: GitHub Pages
- User has GitHub account, walking through setup
- Repo: `matri-argentina` (to be created)
- File: `index.html` (renamed from `matri-argentina-calculator.html`)
- URL will be: `https://[github-username].github.io/matri-argentina/`
- Steps: Create repo → Upload file → Settings → Pages → Branch: main / root

### Future: Custom domain
- Can add CNAME record pointing to GitHub Pages
- Or migrate to VPS / managed hosting when backend is needed

---

## 8. TODO — Phase 2

### High priority
- [ ] **Multi-room summary:** Add multiple rooms in one session, show combined order total (quantities per pouch size + total cost)
- [ ] **PDF / print output:** Printable calculation summary per room or per session
- [ ] **Admin price persistence:** Currently resets on page reload — needs localStorage or backend
- [ ] **Per-client price URL parameter:** `?price=0.90&client=KleppeSA` so FreshInset can send pre-configured links

### Medium priority
- [ ] **User login / authentication:** Port from `matri_argentina_portal.html` prototype
- [ ] **Room management:** Save rooms with names, dimensions, crop type
- [ ] **Order history:** Log completed calculations, export to CSV or PDF
- [ ] **App log:** Record of applications per room per season

### Lower priority / future
- [ ] **Backend database:** Connect to API for storing orders (match US portal pattern)
- [ ] **Crop selector:** Different dose recommendations by crop (pears, apples, kiwi…)
- [ ] **Bins input mode:** Alternative to m³ for Matri Powder
- [ ] **Generator module:** Equipment rental/purchase (exists in portal prototype)
- [ ] **Document library:** Labels, SDS sheets, application guides

---

## 9. Business Context

- **Product:** 1-Methylcyclopropene (1-MCP) — delays ethylene-driven ripening in cold storage
- **Brand:** MaTri (by Agrofresh / distributed by FreshInset in Argentina)
- **Argentine distributor:** Wassington (Tier 1), Podlesh (Tier 2, Río Negro region)
- **Key crops:** Pears, apples, kiwi
- **US reference portal:** `https://ytbe.com/clients/_sites/ma-tri.com/` (requires login)
- **New US portal:** `https://matri-shop-review.20-106-130-58.nip.io/calculator`
- **Pricing currency:** USD (standard for agri-inputs in Argentina even when invoiced in ARS)
- **Season reference:** 2026 harvest season

---

## 10. Files in This Project

| File | Description |
|---|---|
| `matri_argentina_portal.html` | Full portal prototype (landing + authenticated portal, multi-panel) — in project knowledge |
| `matri-argentina-calculator.html` | Phase 1 standalone calculator — output file for deployment |
| `MATRI_ARGENTINA_PROJECT_KNOWLEDGE.md` | This document — single source of truth |

---

*This document is the single source of truth for all Claude conversations within the FreshInset project. Always reference this before starting new work on the MaTri Argentina portal.*
