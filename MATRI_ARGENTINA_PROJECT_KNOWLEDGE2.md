# FreshInset — Project Knowledge Base
## MaTri Argentina Portal + Postharvest Tools Suite
**Last updated:** June 2026
**Status:** MatriPortal v1 live on GitHub Pages · 1-MCP Dose Calculator built · Multi-file GitHub site in progress

---

## 1. Project Overview

FreshInset is building a **Spanish-language web suite** for the Argentine market centred on MaTri 1-MCP postharvest technology. The project has two distinct but related tracks:

**Track A — MaTri DoseRight Calculator (index.html)**
A Spanish-language calculator for cold-storage operators to calculate the exact dose of MaTri product (Powder or Tablets) for each room, show the optimal packaging combination, and calculate cost. Mirrors the US portal at `https://ytbe.com/clients/_sites/ma-tri.com/`.

**Track B — 1-MCP Dose Calculator (1mcp-dose-calculator.html)**
A scientific postharvest reference tool — crop-by-crop, variety-by-variety 1-MCP dose suggestion engine based on measured harvest parameters (Starch Index, IEC, Firmness, Dry Matter, Brix, Skin Color). Includes calibration curves, maturity adjustment logic, and a fine-tune slider for the user's final decision. Aimed at postharvest technologists and agronomists.

Both tools are **standalone HTML files** on the same GitHub Pages repo — no build step, no backend, no dependencies except Google Fonts CDN (Track B).

**Phase 1 (complete):** Both HTML calculators built and deployable.
**Phase 2 (planned):** Full portal with login, room management, order history, cross-tool navigation.

---

## 2. GitHub Pages Deployment Architecture

```
GitHub Repo (e.g. github.com/user/freshinset)
│
├── index.html                    ← MaTri DoseRight Calculator (Track A) — LIVE
├── 1mcp-dose-calculator.html     ← 1-MCP Dose Calculator (Track B) — upload pending
└── (future) tools/               ← Additional tools as they are built
```

**URL pattern:** Each HTML file becomes its own URL automatically.
- `https://user.github.io/freshinset/` → MatriPortal (index.html)
- `https://user.github.io/freshinset/1mcp-dose-calculator.html` → 1-MCP Calculator

**To upload a new file:** GitHub repo → Add file → Upload files → Commit to main → live in ~2 min.

**Do NOT rename 1mcp-dose-calculator.html to index.html** — that would overwrite the MatriPortal.

**Future organisation options (when >5 tools):**
- Folder per tool: `tools/1mcp/index.html` → URL: `yoursite/tools/1mcp/`
- Navigation hub: update index.html to include a card grid linking to all tools

---

## 3. Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language (Track A) | Spanish only | Argentina market |
| Language (Track B) | English | Scientific/technical audience; international use possible |
| Backend | None (Phase 1) | Speed to market; GitHub Pages is static-only |
| Hosting | GitHub Pages | Free, already set up, no server needed |
| Multi-file strategy | Multiple HTML files in same repo | Each gets its own URL; no routing needed |
| Track A design | Match US MaTri portal exactly | Navy/lime/coral palette, system-ui font |
| Track B design | Independent green postharvest theme | Inter + JetBrains Mono; --green-900 header |
| Track A dependencies | Tabler Icons CDN only | No font CDN; fastest load |
| Track B dependencies | Google Fonts CDN only | Inter + JetBrains Mono; all JS inline |
| Dose logic (Track B) | Multivariate model, not a lookup table | No single published calibration curve exists; model encodes research relationships |
| Fine-tune slider | Always present; user makes final call | Tool suggests, technologist decides |

---

## 4. Track A — MaTri DoseRight Calculator (index.html)

### 4.1 Product Specifications

**Matri Powder**
- Active ingredient: 1-MCP at 3.3% concentration
- Standard dose: `0.067 g per m³ = 1,000 ppb`
- Formula: `grams = volume_m3 × 0.067 × (target_ppb / 1000)`
- Dose range: 100–5,000 ppb (user-adjustable)
- Pouch sizes in Argentina: 10g, 20g, 50g, 100g
- Algorithm: Greedy descending (100→50→20→10g), ceiling rounding

**Matri Tablets**
- Small tablet: covers 2.5 m³
- Large tablet: covers 5 m³
- Algorithm: `large = floor(vol/5)`, `small = ceil(rem/2.5)`

**Pricing**
- Reference: $0.85 USD/m³ at 1,000 ppb
- Scaling: `cost = vol × price_per_m3 × (actual_ppb / 1000)`
- Admin-configurable via embedded panel (runtime only — resets on reload)

### 4.2 Completed Modules

**✅ Matri Powder Calculator**
- Inputs: room name (optional), volume (m³), target dose (ppb, default 1,000)
- Greedy ceiling combination → if rounding excess >1%, triggers Dose Choice Flow:
  - Opción A: use extra pouch → exact target ppb, higher cost
  - Opción B: drop extra pouch → lower ppb (shown explicitly), lower cost
- Cost banner (dark navy): total USD, USD/m³, actual ppb delivered

**✅ Matri Tablets Calculator**
- Inputs: room name (optional), volume (m³)
- Optimal large/small combination
- Cost banner: total USD, USD/m³, total m³ covered, excess note

**✅ Admin Panel (FreshInset internal)**
- Hidden behind "Configurar precio" button in top bar
- Fields: base price ($/m³ at 1,000 ppb), client name
- Client name propagates to header label

**✅ Design System**
```
--navy:   #0b4358   headings, nav, metric values, cost banner bg
--lime:   #b5cc2e   hero banner, result card border, admin accent
--coral:  #e8736a   CTA buttons, pouch qty, Opción A
--cream:  #f5f5ee   page background, metric boxes
--green:  #3b6d11   Opción B / adjusted dose
--white:  #ffffff   cards
Font: system-ui / -apple-system / Segoe UI (no CDN dependency)
Icons: Tabler Icons CDN
```

**✅ Full Portal Prototype (matri_argentina_portal.html — in project files)**
Multi-view prototype with landing page, sign-in/register modal, authenticated portal with sidebar: Dashboard, Rooms, Orders, Calculator, Generators, Documents, App Log, Profile. Demo data for Kleppe S.A. (Tier 1). Session timer, tier badges. MaTri SVG logos embedded as base64.

### 4.3 Key Code Patterns (Track A)

```javascript
// Dose calculation
lastGrams = volume_m3 × DOSE_BASE × (target_ppb / 1000)
// DOSE_BASE = 0.067 g/m³ at 1,000 ppb

// Pouch optimization — ceiling (never under-dose)
function greedyCeiling(grams) {
  let rem = grams, r = [];
  for (const s of POUCHES) { const q = Math.floor(rem/s); r.push({size:s,qty:q}); rem -= q*s; }
  if (rem > 0.001) r[r.length-1].qty += 1; // round up smallest
  return r;
}
// POUCHES = [100, 50, 20, 10] — descending

// Actual ppb from a combo
function actualPpb(totalG, vol) { return (totalG / (vol * DOSE_BASE)) * 1000; }

// Cost (proportional to ppb)
function calcCost(vol, ppb) { return vol × pricePerM3At1000 × (ppb / 1000); }

// Dose choice trigger
const needsChoice = exactExcess > 1.0 && adjG > 0 && adjG !== exactG;

// Tablet algorithm
const large = Math.floor(vol / 5);
const small = Math.ceil((vol - large * 5) / 2.5);

// Number formatting — Argentine locale
function fmtUSD(v) { return '$' + v.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
```

---

## 5. Track B — 1-MCP Dose Calculator (1mcp-dose-calculator.html)

### 5.1 Purpose & Scope

Scientific postharvest reference tool. Suggests the appropriate 1-MCP dose for a given crop/variety based on measured maturity parameters at harvest, storage destination, harvest delay, atmosphere type, and treatment temperature. The dose model is **multivariate** — there are no single published calibration curves mapping one parameter to one dose. The model encodes the additive relationships documented in the literature.

### 5.2 Crops & Varieties Implemented

| Crop | Varieties in dropdown | Key maturity parameters |
|---|---|---|
| Apple | Gala, Fuji, Granny Smith, Honeycrisp, Golden Del., Red/Starking, Braeburn/Pink Lady, McIntosh | Starch Index (1–8), IEC (µL/L), Firmness (lbf) |
| Pear | Bartlett/Williams, D'Anjou/Conference, Bosc/Kaiser, Abate Fétel, Rocha, Packham's | Firmness (lbf), IEC (µL/L), TSS Brix |
| Avocado | Hass, Fuerte, Reed, Lamb Hass, Holiday | Dry Matter (%), Firmness (N), Skin Color (1–5) |
| Mango | Tommy Atkins, Kent, Keitt, Ataulfo, Nam Dokmai, Carabao, Alphonso | Firmness (N), Color break (%), TSS Brix |
| Kiwifruit | Hayward (green), Zespri SunGold, Hort16A, Red kiwi | Dry Matter (%), Firmness (kg), TSS Brix |
| Banana | Cavendish, Plantain, Lady Finger, Red, Gros Michel | Peel color stage (1–7), Firmness (N), Pulp Brix |
| Peach | Elegant Lady, O'Henry, Redhaven, Cresthaven, Madoka, Rich Lady | Firmness (N), TSS Brix, Skin blush (%) |
| Tomato | Round/beefsteak, Cluster, Cherry/grape, Plum/Roma, Cocktail | Ripening stage (1–6), Firmness (N), TSS Brix |

### 5.3 Dose Model Architecture

Every crop has a `calcDose(params, dest, delay, atm, temp)` function that returns:

```javascript
{
  base,        // crop base dose (ppb) — from label/literature consensus
  adj,         // total adjustment (ppb)
  adjs,        // array of {label, delta, reason} — shown as pills with tooltips
  total,       // final calculated dose (base + adj, clamped to crop range)
  dur,         // recommended exposure duration ("12–24 h" or "24 h")
  shelf,       // expected shelf life extension string
  calcNote,    // scientific rationale paragraph
  warning      // alert string if parameters indicate poor treatment window (or "")
}
```

**Base doses by crop:**
```
Apple:     500 ppb    Pear:    300 ppb    Avocado:  500 ppb
Mango:     300 ppb    Kiwi:    625 ppb    Banana:  2000 ppb
Peach:     500 ppb    Tomato:  500 ppb
```

**Adjustment logic — universal factors:**

| Factor | Direction | Mechanism |
|---|---|---|
| Advanced maturity (high SI, high IEC, low firmness, low DM) | ↑ dose | Endogenous ethylene competes with 1-MCP for receptor binding |
| Longer storage / CA destination | ↑ dose (RA) or ↓ dose (CA) | CA + 1-MCP synergy allows dose reduction |
| Harvest delay | ↑ dose | Receptors become progressively occupied during delay |
| Sub-optimal treatment temp | ↑ dose | Slows 1-MCP diffusion into tissue |
| Pear-specific: cold treatment temp | ↑ dose | Pears bind best at 18–22°C |
| CA atmosphere | ↓ dose | ~100 ppb reduction for apple; ~75–125 ppb for others |

**Dose clamping by crop:**
```
Apple: 100–2000 ppb    Pear: 100–700 ppb (dose-sensitive — risk of permanent inhibition above 600)
Avocado: 100–1500 ppb  Mango: 100–1000 ppb   Kiwi: 200–1200 ppb
Banana: 500–5000 ppb   Peach: 200–1500 ppb   Tomato: 200–1500 ppb
```

**Critical pear note:** >600 ppb risks permanent ripening inhibition. Pears also require >60 cold days post-treatment to recover ripening ability. This is encoded in the warning system.

### 5.4 Calibration Curves

Each crop has a `curves` array of `{id, label, xMin, xMax, fn, unit}` objects. Each curve:
- Is rendered as an inline SVG (300×110px viewBox)
- Shows the parameter's delta contribution to the dose model
- Tracks a live red dot at the current slider value
- Shows zero-line dashed if the range crosses zero

Curves implemented per crop:
- Apple: SI → adj, IEC → adj, Firmness → adj
- Pear: Firmness → adj, IEC → adj, Brix → adj
- Avocado: DM → adj, Firmness → adj, Color stage → adj
- Mango: Firmness → adj, Color break % → adj, Brix → adj
- Kiwifruit: DM → adj, Firmness → adj
- Banana: Color stage → adj, Firmness → adj
- Peach: Firmness → adj, Brix → adj
- Tomato: Ripening stage → adj, Firmness → adj

### 5.5 UX Flow (4 steps)

```
Step 1: Select Crop + Variety
  → crop description appears below; dest dropdown populates
Step 2: Maturity Parameters (sliders)
  → each slider has color-coded badge: green=ideal / amber=caution / red=advanced maturity
  → track fill color updates on slide
Step 3: Storage & Logistics (2×2 grid)
  → Destination, Atmosphere, Hours since harvest (0–72h), Treatment temperature (0–25°C)
Step 4: Result Panel
  → 3 metric cards: Base dose / Maturity Δ / Logistics Δ
  → Adjustment pills (hoverable tooltips with scientific rationale)
  → Large dose number + range badge (Low/Standard/High/Very high)
  → Fine-tune slider (50–5000 ppb) — synced to calculated dose, user overrides
  → Final result box: selected dose + exposure duration + shelf extension
  → Scientific note paragraph
  → Warning box (amber, appears when parameters indicate poor treatment window)
  → Calibration curves panel (SVG, live dot)
```

### 5.6 Key Code Patterns (Track B)

```javascript
// Crop data structure
const CROPS = {
  CropName: {
    desc: "...",           // shown in crop-desc box
    varieties: [...],      // populates variety dropdown
    params: [              // drives Step 2 sliders
      {id, name, unit, min, max, step, default, desc, lowGood, highBad}
    ],
    dests: [...],          // populates destination dropdown
    baseDose: N,           // ppb
    calcDose(p, dest, delay, atm, temp) { ... return {base,adj,adjs,total,dur,shelf,calcNote,warning}; },
    curves: [
      {id, label, xMin, xMax, fn: x => delta_ppb, unit}
    ]
  }
};

// Badge color logic per parameter
// lowGood > highBad means "high is bad" (e.g. Starch Index — higher = more advanced)
// lowGood < highBad means "low is bad" (e.g. firmness — lower = more advanced)
const inverted = p.lowGood > p.highBad;
if (!inverted) { cls = v < p.lowGood ? "bad" : v > p.highBad ? "warn" : "ok"; }
else           { cls = v > p.lowGood ? "bad" : v < p.highBad ? "warn" : "ok"; }

// SVG curve rendering — inline, no canvas, no library
const px = x => padL + (x - xMin) / (xMax - xMin) * plotW;
const py = y => padT + plotH - ((y - yMin) / yRange) * plotH;
const pathD = pts.map((p, i) => (i===0?"M":"L") + px(p.x) + "," + py(p.y)).join(" ");

// Unicode safety — CRITICAL BUG HISTORY:
// U+2212 (−) UNICODE MINUS in JS numeric context causes silent syntax error
// All numeric negatives must use ASCII hyphen-minus (-)
// En-dashes (–) and em-dashes (—) are safe inside string literals only
```

### 5.7 Known Bug — Fixed

**Unicode minus (U+2212) in Apple destAdj array** caused a JS syntax error that silently killed the entire script block. Fixed in the current output file. Prevention: always scan new JS for non-ASCII chars in operator positions before shipping.

```bash
# Scan command used to detect
python3 -c "
content = open('file.html').read()
script = content[content.find('<script>'):content.rfind('</script>')]
bad = [(i, hex(ord(c)), c) for i, c in enumerate(script) if ord(c) > 127]
print(bad)"
```

---

## 6. Scientific Literature References (Track B)

| Crop | Key finding | Source |
|---|---|---|
| Apple | Riper fruit (SI>5, IEC>1 µL/L) requires higher doses; delay >48h significantly reduces efficacy | Mattheis et al. 2005; DeEll et al. 2008; Fan et al. 1999 |
| Pear | 100–500 ppb effective range; treatment at 20°C for 24h optimal; >60 cold days needed post-treatment | Calvo & Sozzi 2009; Villalobos-Acuña et al. 2011 |
| Avocado | Low DM (20–23%) and high DM (27%) both respond if treated within 14 days post-harvest | Calvo-Salazar et al. 2022 |
| Mango | 250 ppb optimal for Tommy Atkins firmness without suppressing aroma volatiles | Uthairatanakij et al. 2017 |
| Kiwifruit | CA (2 kPa O₂ / 5 kPa CO₂) + 1-MCP = gold standard; up to 8 months storage | Industry protocols |
| Banana | Effective only at Stage 1–2; Stage 3+ = cascade too advanced | Industry protocols |
| Peach | Reduces woolly breakdown; combine with prestorage high-CO₂ (30% CO₂ / 6h) | Tilahun et al. 2022 |
| General | Delays in application result in progressively higher IEC at treatment and lower post-storage firmness | Multiple sources |

---

## 7. Business Context

- **Product:** 1-Methylcyclopropene (1-MCP) — delays ethylene-driven ripening in cold storage
- **Brand:** MaTri (by Agrofresh / distributed by FreshInset in Argentina)
- **Distributor tiers:** Wassington (T1, large accounts), Podlesh (T2, Río Negro), T3+ (kiwi growers, other regions)
- **Key crops:** Pears, apples, kiwi (Argentina); Track B expands to avocado, mango, banana, peach, tomato, flowers
- **US reference portal:** `https://ytbe.com/clients/_sites/ma-tri.com/` (requires login)
- **New US portal:** `https://matri-shop-review.20-106-130-58.nip.io/calculator`
- **Pricing currency:** USD (standard for agri-inputs in Argentina even when invoiced in ARS)
- **Season reference:** 2026 harvest season

---

## 8. TODO

### Track A — MaTri DoseRight Calculator
- [ ] **Multi-room summary:** Add rooms in session, show combined order (quantities per pouch size + total cost)
- [ ] **PDF / print output:** Printable calculation summary per room or session
- [ ] **Admin price persistence:** Currently resets on reload — needs localStorage or backend
- [ ] **Per-client price URL param:** `?price=0.90&client=KleppeSA` for pre-configured links
- [ ] **User login / authentication:** Port from matri_argentina_portal.html prototype
- [ ] **Room management:** Save rooms with names, dimensions, crop type
- [ ] **Order history:** Log calculations, export CSV or PDF
- [ ] **Crop selector in calculator:** Different dose recommendations by crop
- [ ] **Bins input mode:** Alternative to m³ for Matri Powder
- [ ] **Generator module:** Equipment rental/purchase (prototype exists)
- [ ] **Document library:** Labels, SDS sheets, application guides

### Track B — 1-MCP Dose Calculator
- [ ] **Navigation back-link to MatriPortal:** Add header link once both are on same GitHub site
- [ ] **More crops:** Plum, blueberry, persimmon, melon, papaya, cut flowers
- [ ] **Export / print:** Printable dose recommendation card with all parameters
- [ ] **Spanish language toggle:** For Argentine market use
- [ ] **Expand dosing table:** Full reference table (30+ entries) as companion tab to the calculator — built in prior session as React component, needs conversion to plain HTML
- [ ] **Registration / login:** Gate for FreshInset clients only (Phase 2)
- [ ] **Preharvest 1-MCP module:** Preharvest spray doses (mango Carabao, avocado)

### Both Tracks
- [ ] **Cross-tool navigation bar:** Header component linking MatriPortal ↔ 1-MCP Calculator ↔ future tools
- [ ] **Shared admin / price config:** Single admin entry that propagates across tools
- [ ] **Backend / database:** When Phase 2 begins; currently all state is runtime JS

---

## 9. Files in This Project

| File | Location | Description |
|---|---|---|
| `index.html` | GitHub Pages root | Track A — MaTri DoseRight Calculator (live) |
| `1mcp-dose-calculator.html` | GitHub Pages root | Track B — 1-MCP Dose Calculator (upload pending) |
| `matri_argentina_portal.html` | Project knowledge | Full portal prototype — landing + auth + sidebar panels |
| `MATRI_ARGENTINA_PROJECT_KNOWLEDGE.md` | Project knowledge | **This document — single source of truth** |

---

## 10. Session History Summary

| Session | What was built |
|---|---|
| Session 1–3 | Track A: Powder + Tablets calculators, admin panel, design system, GitHub Pages setup |
| Session 4 | Track A: Full portal prototype (matri_argentina_portal.html) — multi-panel, auth flow, demo data |
| Session 5 | Track B: 1-MCP dosing table (React) — 30 entries, 15 crops, filters, expandable rows |
| Session 6 | Track B: 1-MCP Dose Calculator — 8 crops, maturity sliders, dose model, calibration curves, fine-tune slider |
| Session 7 | Track B: Converted to standalone HTML; fixed Unicode minus bug; confirmed JS valid |
| Session 7 | GitHub multi-file strategy explained; this knowledge base updated |

---

*This document is the single source of truth for all Claude conversations within the FreshInset project. Every new chat should search this document before starting any work. Last substantive update: June 2026.*
