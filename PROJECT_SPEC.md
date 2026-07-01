# MaTri Dosing Portal — Argentina
## Project Specification & Reconstruction Guide
**Version:** 1.0  
**Date:** July 2026  
**Status:** Functional prototype — pre-production  
**Repository:** https://github.com/Ar1xjl/Matri-argentina  
**Live URL:** https://matri-argentina.vercel.app  

---

## 1. Project overview

A web and mobile portal for Argentine cold-storage operators to order, manage, and verify 1-MCP ethylene-inhibitor treatments for their fruit rooms. Built for FreshInset / MaTri, distributed exclusively in Argentina by Wassington.

**Tech stack:**
- React 18 + Vite 8
- No backend yet (state lives in React — Supabase planned for production)
- Hosted on Vercel (auto-deploys from GitHub main branch)
- Node 24 / npm 11

---

## 2. Commercial structure

| Tier | Customer type | Managed by | Examples |
|---|---|---|---|
| T1 | Large accounts | Wassington directly | Kleppe, Tres Ases |
| T2 | Mid accounts — Río Negro | Podlesh (retailer) | Medium packinghouses |
| T3+ | Small / kiwi operators | Other retailers | Kiwi growers, other regions |

**Key rule:** Tiers are table-driven. Adding a new tier or retailer requires only an admin config change — no code change.

---

## 3. Products

| Product | Description | Application |
|---|---|---|
| MatriPowder | Active 1-MCP powder, 3.3% | Requires MaTri generator |
| MatriTablets | Effervescent tablets (like vitamin C) | Self-application, no generator needed |
| MatriSure Kit | Color-change dose verification strips | Photo uploaded post-treatment |
| MaTri Generator | Professional application unit | Tracked by individual ID (GEN-001, etc.) |

---

## 4. Portal architecture

Three distinct experiences sharing one codebase, role-based:

### 4.1 Public landing page (`/`)
- Top info bar (navy `#072e3d`)
- MaTri logo + nav with "Ingresar" (coral CTA) and "Solicitar acceso"
- Hero band (lime-yellow `#c8d84a`) with "Matri System" title
- Hero section with 4 product images in 2×2 grid
- Products section (4 cards with real product images and logos)
- How it works (3 steps)
- Tier structure (navy background, 3 cards)
- CTA band + footer
- Login/Register modal with Argentine fiscal fields (Razón Social, CUIT, Situación Fiscal)

### 4.2 Customer portal (authenticated)
8 sidebar sections:
1. **Dashboard** — real-time stats from shared order state, recent orders, room summary, quick actions
2. **Cámaras y ubicaciones** — room list with history button per room
3. **Pedidos** — full order list with status, reject reason visible to customer
4. **Calculadora de dosis** — 3 alternatives (Powder exact, Powder adjusted, Tablets) with real pricing from pricing engine, DoseRight integration
5. **Generadores** — buy/rent cards + ROI calculator (recommends buy vs rent vs managed service based on # rooms and treatments)
6. **Documentos** — versioned document library (labels, manuals, MatriSure guide)
7. **Registro de aplicaciones** — application log with MatriSure photo upload (live camera only), room history viewer
8. **Mi perfil** — company data, password change

### 4.3 Admin portal — Panel Wassington
3 tabs:
- **Pedidos y aprobación** — pending queue with Approve (editable price) / Reject (with reason) modal, processed history
- **CRM — Clientes** — full customer list with tier, retailer, status
- **Gestión de precios** — 4 editable pricing tables (see Section 6)

---

## 5. Key flows

### Registration
1. New visitor registers with: Razón Social, CUIT (AFIP format), Situación Fiscal, email, phone, province
2. Account created in "Pending" status
3. Wassington reviews, assigns tier + retailer, sets credit terms
4. Customer receives temp password by email
5. Force password change on first login

### Authentication
- Email + password only (no social login)
- Password reset: admin-controlled only — Wassington generates temp password
- Session timeout: warning at 8 minutes, hard logout at 10 minutes
- Session timer visible in portal top bar

### Order flow
1. Customer opens Calculator, selects room + dose
2. System shows 3 alternatives with real prices
3. Customer selects alternative + service model (managed vs self-application)
4. Order submitted → status "pending" → appears in Wassington queue AND customer Orders section
5. Wassington approves (can adjust price) or rejects (with reason)
6. Status updates across all views (Dashboard, Orders, Wassington panel)

### Application log
- Created automatically when order approved
- Required fields: dose (ppb, editable), operator name, generator ID, start time, end time
- Optional fields: room temperature, maturity parameters (firmness, brix, IEC), certification tag (GlobalGAP, BRC)
- MatriSure photo: live camera only (no gallery upload), auto-timestamped
- Dose verification: Wassington/retailer reviews photo and marks confirmed/not reached

### Room history
- Accessible from Rooms section (button per room) and from Application Log
- Chronological list of all treatments, filterable by season (2025, 2026, etc.)
- Shows: date, crop/variety, dose, operator, generator, MatriSure status
- Export to PDF/Excel buttons (UI built, logic pending)

---

## 6. Pricing engine

**File:** `src/data/pricing.js` — single source of truth for all prices.

**Volume brackets (shared across all tables):**
- XS: 0–600 m³
- SM: 600–1200 m³
- MD: 1200–1800 m³
- LG: 1800+ m³

**4 pricing tables, all editable by Wassington in the Gestión de precios tab:**

1. **MatriPowder** — $/m³ by Tier × Bracket
2. **MatriTablets** — $/m³ by Tier × Bracket
3. **Servicio de aplicación** — $/room (fixed charge, Powder managed service only) by Tier × Bracket
4. **Generadores** — purchase price + daily rental by Tier × Bracket

**Price logic:**
- Customer sees indicative price in calculator (product cost + service fee if applicable)
- Wassington can adjust final price at approval
- Tablets = always self-application, no service fee
- Powder = choice of managed service or self-application

**To add a new SKU:** add an entry to `PRODUCT_PRICES` in `src/data/pricing.js` — no other changes needed.

---

## 7. Calculator — DoseRight integration

The calculator has two parts:

**Part 1 — MaTri Calculator** (`src/components/Portal/Calculator.jsx`)
- Selects room + dose in ppb
- Shows 3 alternatives side by side with real prices from pricing engine
- Service model selector for Powder options
- "Confirmar y enviar pedido" adds order to shared state → appears in Orders + Wassington queue

**Part 2 — DoseRight Scientific Calculator** (separate module)
- URL: `https://ar1xjl.github.io/Matri-argentina/1mcp-dose-calculator.html`
- Opens in popup window via `window.open()` (NOT a regular link — required for postMessage)
- User adjusts dose with slider → clicks "Usar esta dosis en la calculadora"
- Sends `postMessage({ type: 'MATRI_DOSE', ppb: value })` to opener
- Calculator receives via `useEffect` event listener and pre-fills the ppb field

---

## 8. Generator ROI calculator

Located in `src/components/Portal/Generators.jsx`

**Inputs:** number of Powder rooms, treatments per room per season, average room volume  
**Outputs:** comparison table (managed service vs rental vs purchase) + automatic recommendation  
**Logic:**
- `breakEvenTreatments = Math.ceil(genPurchase / serviceFee)`
- If `totalTreatments >= breakEvenTreatments` → recommend purchase
- If `totalTreatments >= 4` → recommend rental
- Otherwise → recommend managed service

---

## 9. File structure

```
src/
├── assets/
│   ├── images/         MatriPowder.png, MatriTablets.png, MatriGenerator.png, MatriSure_Kit.png
│   └── logos/          MatriPowder_Logo.svg, MatriTablets_Logo.svg, MatriGenerator_Logo.svg, MatriSure_Logo.png
├── components/
│   ├── Auth/           AuthModal.jsx
│   ├── Landing/        Landing.jsx
│   ├── Portal/
│   │   ├── Portal.jsx              ← shared state hub (orders, addOrder, approveOrder, rejectOrder)
│   │   ├── Dashboard.jsx           ← real-time stats from shared orders
│   │   ├── Rooms.jsx               ← room list + new room form + history button
│   │   ├── Orders.jsx              ← customer order list, reads shared state
│   │   ├── Calculator.jsx          ← 3-alternative calculator with pricing engine
│   │   ├── Generators.jsx          ← buy/rent cards + ROI calculator
│   │   ├── Documents.jsx           ← versioned document library
│   │   ├── AppLog.jsx              ← application log + MatriSure verification
│   │   ├── ApplicationForm.jsx     ← form for logging a treatment
│   │   ├── RoomHistory.jsx         ← treatment history per room, filterable by season
│   │   ├── Wassington.jsx          ← admin panel (orders, CRM, pricing tabs)
│   │   ├── PricingPanel.jsx        ← editable pricing tables
│   │   └── Profile.jsx             ← customer profile + password change
│   └── Shared/
│       ├── Navbar.jsx              ← public landing nav
│       └── Sidebar.jsx             ← portal sidebar navigation
├── data/
│   └── pricing.js                  ← pricing engine (single source of truth)
├── App.jsx                         ← routes between landing / portal
└── index.css                       ← design system tokens
```

---

## 10. Design system

**Brand colors (from US MaTri site `#0b4358` theme color):**
```css
--navy:       #0b4358   /* primary, sidebar, headings */
--navy-dark:  #072e3d   /* top bar, footer */
--lime:       #b5cc2e   /* accent, active states, sidebar indicator */
--lime-band:  #c8d84a   /* hero band background */
--lime-pale:  #f0f7e0   /* light lime backgrounds */
--coral:      #e8736a   /* CTA buttons, Sign in */
--cream:      #f5f5ee   /* page background */
--border:     #ddddd5   /* all borders (0.5px) */
```

**Key UI patterns:**
- Cards: white, `border-radius: 12px`, `border: 0.5px solid #ddddd5`, `box-shadow: 0 1px 3px rgba(0,0,0,.08)`
- Tables: `0.5px solid` borders, `#f5f5ee` header background
- Status badges: rounded pills (approved=teal, pending=amber, confirmed=blue, rejected=red)
- All prices in USD

---

## 11. What is NOT yet built (pending for production)

| Feature | Status | Notes |
|---|---|---|
| Real database | ❌ Pending | Recommended: Supabase. All state is in React memory today |
| Real authentication | ❌ Pending | Any email/password works today |
| Email notifications | ❌ Pending | Order approved/rejected emails to customer |
| MatriSure live camera | ❌ Pending | Gallery upload currently allowed — needs camera-only enforcement |
| Export PDF/Excel | ❌ Pending | Buttons exist in RoomHistory, logic not built |
| Multi-room negotiation | ❌ Pending | Currently one order per room. Future: cart/negotiation model |
| AI MatriSure color check | ❌ Future | Auto-classify strip photo color = dose reached Y/N |
| FreshInset replenishment API | ❌ Future | Auto purchase order when SKU stock falls below threshold |
| Real SKU stock tracking | ❌ Pending | Pouch optimizer uses all sizes regardless of stock |
| Retailer portal | ❌ Pending | Podlesh / Tier 3 retailers need scoped view of their customers only |

---

## 12. How to reconstruct this project

If starting from scratch, give Claude this file and say:

> "Read PROJECT_SPEC.md carefully. I need you to rebuild the MaTri Argentina portal described in this spec. Start by setting up a React + Vite project, then build component by component following the file structure in Section 9. Use the design system in Section 10. The pricing engine in Section 6 should be built first as it is a dependency of the Calculator component."

**Prerequisites:**
- Node 22+ and npm installed
- GitHub account and repository created
- Vercel account connected to GitHub for deployment
- Product images and logos available (MatriPowder.png, MatriTablets.png, MatriGenerator.png, MatriSure_Kit.png and their SVG/PNG logos)

**Setup commands:**
```bash
npm create vite@latest Matri-Argentina -- --template react
cd Matri-Argentina
npm install
npm run dev
```

---

## 13. Key decisions made during development

- **No social login** — email + password only for B2B Argentine market
- **Admin-controlled password reset** — Wassington generates temp passwords (not self-service)
- **Tablets always self-application** — effervescent product, no generator needed
- **3 calculator alternatives always shown** — no hidden segmentation by room size; transparent comparison
- **Live camera only for MatriSure** — prevents backdating of dose verification photos
- **Tier system table-driven** — new tiers/retailers need only config change, not code
- **Pricing in USD throughout** — product, service fee, generator all in USD
- **Volume brackets: 0–600 / 600–1200 / 1200–1800 / 1800+ m³**
- **Service fee applies to Powder managed service only** — Tablets never have service fee
- **Generator ROI calculator** — recommends buy vs rent vs managed service based on treatment volume

---

*Document generated July 2026. Update this file whenever significant architectural decisions are made.*
