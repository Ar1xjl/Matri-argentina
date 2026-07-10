# DOMAIN_MODEL.md

> Adopted 2026-07-03 as the canonical domain model for MaTri Portal, superseding earlier generic drafts and the preliminary organization-hierarchy sketch in `PROJECT_SPEC.md` Section 14 (kept there only as a pointer to this document). Source: consolidated with FreshInset team feedback on the Vercel prototype.

---

## Purpose

Describe the MaTri Portal business domain independently of any technology, implementation or programming language. This document defines the business entities, relationships, rules and terminology that form the foundation of the platform.

---

## Domain Overview

Core concepts:
- **Organization** is the root business entity for ownership and security.
- **Treatment** is the core operational entity.
- **Users** belong to Organizations and hold one or more Business Roles.
- **Pricing, Documentation, Cold Rooms and Generators** belong to Organizations.
- **Treatments** reference Cold Rooms, Generators, Pricing and Dose information.
- **MatriSure Verification** is a sub-entity of Treatment, recording physical dose confirmation.

---

## Core Entities

### Organization

Represents any business entity in the hierarchy (FreshInset Global, Distributor, Sub-distributor or Customer). Owns Users, Pricing, Documentation, Cold Rooms, Generators and Treatments.

Every Organization has one parent except FreshInset Global. Visibility, permissions and pricing derive from this hierarchy.

**Organization status:** `pending` → `active`. A newly created Organization — a country Distributor or a Sub-distributor, at any depth — starts as `pending` and must be approved by FreshInset Global before it can operate (create Users beyond its initial Owner, configure Pricing, or receive Treatments). This applies uniformly regardless of who creates the record: even when a Distributor creates its own Sub-distributor (structurally allowed, since the Sub-distributor is within the Distributor's own subtree), that Sub-distributor still requires FreshInset Global's approval to go from `pending` to `active`. See `ORGANIZATION_ONBOARDING.md` for the full process.

**Currency:** each Organization at Distributor level chooses its own operating currency (the legal tender of the market it serves) — this is not a platform-wide constant. Argentina's Wassington has historically priced in USD, but that is a per-distributor choice, not a rule other countries must follow.

**Exchange rate:** each Distributor-level Organization also maintains its own `fx_rate_to_usd`, entered and updated manually by that Organization's Owner — no external FX API integration. This rate is what lets FreshInset Global's consolidated dashboard show a single USD total across countries with different currencies (see Pricing → Pricing snapshot for how this is frozen per Treatment).

**Language:** each Organization may set its own portal display language (independent of currency/country — e.g. a Distributor could operate in English even in a Spanish-speaking market). Not required at onboarding: a new country can launch using an existing language (Spanish/English) and add its local translation later without blocking activation. Providing (and funding) that translation is the responsibility of the Distributor requesting it, not FreshInset Global.

### User

Belongs to **exactly one** Organization and holds one or more Business Roles there. Multiple users per Organization are supported from the first version to reflect real operational structures. This applies uniformly at every level of the tree — FreshInset Global staff, Distributor staff, Sub-distributor staff, and Customer staff are all Users of some Organization, using the same model.

> **One account per Organization (2026-07-03):** a User does not span multiple, unrelated Organizations. If the same person needs to operate on behalf of two different Organizations (e.g. an outside agronomist consulting for two separate Customers), they use a separate account for each — kept deliberately simple rather than modeling cross-organization identity.

**Business Roles:**

| Role | Description |
|---|---|
| Owner | Full access to their Organization and all descendants |
| Approver | Can review, price and approve or reject Treatments submitted by descendants |
| Planner | Can create, edit and submit Treatments |
| Operator | Can record treatment execution and upload MatriSure verification |
| Viewer | Read-only access to Treatments and history |

> An individual User may hold multiple roles within the same Organization (e.g. a small customer's primary contact may be both Planner and Operator).

> **Same model at every level (2026-07-03):** this 5-role model applies uniformly across FreshInset Global, Distributors, Sub-distributors, and Customers — including a one- or two-person Customer, which simply assigns multiple roles to the same person rather than using a separate, simplified permission scheme.

> Business Roles are a permissions layer *within* an Organization — orthogonal to the Organization hierarchy itself. The hierarchy decides *which organizations and customers* a user can see; Business Roles decide *what they're allowed to do* inside the organizations they can see. Both are enforced server-side (see `SYSTEM_ARCHITECTURE.md`).

**User management within an Organization:** fully self-service by that Organization's Owner(s) — inviting a new User and assigning their Business Role(s) requires no approval or notification outside the Organization itself, consistent with the "no formal checklist" onboarding philosophy (see `ORGANIZATION_ONBOARDING.md`).

**Owner minimum and succession:** every Organization must have at least one Owner at all times — the system does not allow removing the last one. Replacing or transferring the Owner of a **Distributor**-level Organization requires FreshInset Global's approval, mirroring the approval required to create the Distributor in the first place (see Business Rule 13). For Sub-distributors and Customers, Owner succession is fully autonomous within that Organization.

### Treatment

Primary business entity representing the complete lifecycle of a MaTri treatment application. Stores status, selected dose, pricing snapshot, audit trail and scientific context. Replaces the informal "Pedido / Order" concept used in the current Argentina-only prototype.

> **Terminology decision (2026-07-03):** "Treatment" replaces "Order/Pedido" everywhere — not just as an internal/technical term. The Spanish-language UI will say **"Tratamiento"** instead of "Pedido" on every screen (navigation, dashboard, forms), and the future database schema uses `treatments` as the table name, not `orders`. The current live prototype still says "Pedido" (`Orders.jsx`, etc.) — that gets renamed as part of the Supabase rebuild, not as a standalone patch to the mockup.

**Treatment lifecycle:**

```
Draft → Submitted → Approved → Applied → Completed
      ↖         ↘ Rejected  ↘ Cancelled
        (edit & resubmit)
```

| State | Description | Actor |
|---|---|---|
| Draft | Being prepared by Planner | Planner |
| Submitted | Sent for approval | Planner |
| Approved | Approved with confirmed price | Approver |
| Applied | Treatment physically executed, pending verification | Operator |
| Completed | MatriSure verification confirmed | Operator / Approver |
| Rejected | Rejected with reason | Approver |
| Cancelled | Withdrawn | Planner |

> **Applied** is a critical intermediate state. It records that the physical treatment was performed (dose, operator, generator, start/end time) but dose verification via MatriSure is still pending. A Treatment cannot move to Completed without a MatriSure Verification record.

> **Rejected → Draft (2026-07-03):** a Rejected Treatment is not a dead end. It returns to Draft, editable by the Planner, keeping the same record and its full history (including the Approver's rejection reason) — it does not need to be recreated from scratch.

> **Cancellation window extended (2026-07-03):** Cancellation is available not only before Approval, but also **Approved → Cancelled** — a customer can still back out after approval, up until the Operator records the physical application (Applied). Once Applied, the Treatment can no longer be cancelled.

**Time-based alerts (2026-07-03):** four situations are flagged visually on the relevant dashboards (badge/highlight only for v1 — no email notifications yet, that's deferred to a future Notification System):
- **Submitted** with no Approver action for too long
- **Approved** but not yet Applied for too long — the days-until-flagged threshold is **configurable per Organization/Cold Room crop**, not a fixed platform number, since 1-MCP's effectiveness is time-sensitive and that sensitivity varies significantly by crop (per DoseRight's scientific model — see `MATRI_ARGENTINA_PROJECT_KNOWLEDGE2.md`)
- **Applied** but no MatriSure Verification ever uploaded (distinct from the existing `not_reached` alert, which fires when a verification *was* uploaded but failed — this one fires on silence)
- **MatriSure uploaded but stuck in `pending_review`** — nobody has confirmed a result yet (see MatriSure Verification below)

### Season Plan

**Added 2026-07-03.** A lightweight, **non-binding** planning tool that sits *before* Treatment in the customer's workflow — it does not replace the existing single-room Calculator (kept as-is, unchanged, for the detailed one-room-at-a-time flow), it complements it for customers who want to plan across multiple Cold Rooms and dates at once.

**Purpose:**
- For the Customer: a simple table to sketch out an entire season across all their Cold Rooms — planned treatment date, target dose, product preference — and play with different doses/timing before committing to anything, with an indicative (non-binding) cost estimate calculated the same way the Calculator does today.
- For the Distributor and FreshInset: visibility into demand *before* it becomes a real Treatment — a Season Plan is visible to ancestor Organizations the same way a Treatment is (same access rule, no special case needed), giving early signal on upcoming volume, useful for generator allocation and planning conversations, independent of what's actually been sold so far.

**Attributes (Plan):** Organization (owner), season/label (e.g. "Temporada 2026"), created-by User, notes.

**Attributes (Plan Line — one row in the table):** Cold Room, planned treatment date, planned dose (ppb), product preference (Powder / Tablets / undecided), indicative cost (computed live from current Pricing, non-binding), notes, status (`planned` / `converted`).

**Rules:**
- A Season Plan and its lines are always non-binding: creating or editing them never triggers any Approver action, never reserves product, and is not a commitment.
- A Planner can **convert** one or more Plan Lines into real Treatments (created in Draft, pre-filled from the plan line's Cold Room/dose/product). The resulting Treatment keeps a reference back to the Plan Line it came from, and the Plan Line's status updates to `converted`.
- A single Cold Room can appear in a Season Plan multiple times (e.g. two treatments planned for the same room across the season).
- Converting a Plan Line does not modify the Season Plan itself — it remains visible as a historical record of what was planned vs. what actually became a Treatment.

### Cold Room

Physical location where Treatments are performed. Belongs to one Organization. Maintains a complete Treatment history across seasons and crop types.

**Attributes:** name, volume (m³), location/establishment, primary crop, notes.

### Generator

Equipment used during powder Treatments. Belongs to one Organization. Each unit is individually identified and traceable across its full operational lifecycle.

**Generator lifecycle:**

```
Available → Dispatched → On Rent → Returned → Available
         ↘ In Service → Repaired → Available
         ↘ Out of Service
```

**Attributes:** unit ID (e.g. GEN-007), serial number, owner Organization, purchase date, total hours used, current status, last service date, notes.

> **Ownership transfers on purchase (2026-07-03):** when a Customer purchases a Generator, its owner Organization actually changes — from the Distributor's fleet to that Customer's own Organization, starting a fresh history from that point. Renting never transfers ownership; it stays a Distributor fleet asset the whole time.

**Dispatch scope (2026-07-03):** a Dispatched/On Rent Generator is checked out for a **rental period** (e.g. a season), not for a single Treatment — the same physical unit can be used across multiple Treatments during that period. Each individual Treatment simply records which Generator unit ID was used for that specific application; the Generator's own lifecycle status tracks the broader rental relationship, not a 1:1 link to one Treatment.

**Pre-dispatch checklist** (recorded per dispatch event): battery charged, seals intact, test run completed, last service within acceptable interval. **This is a blocking gate (2026-07-03)** — unlike the administrative "no formal checklist" pattern used for Organization onboarding, this one is about physical equipment safety: a Generator cannot be marked Dispatched until the checklist is complete.

> MatriTablets do not require a Generator. Generator is optional on Treatment and only relevant when product is MatriPowder.

### Inventory

Tracks on-hand quantity of each Product SKU variant held by a Distributor-level Organization. Introduced 2026-07-10 after a first customer-facing demo surfaced it as a real operational gap.

**v1 scope (2026-07-10):** tracked only at the Distributor level (e.g. Wassington) — Sub-distributor-level breakdown, low-stock alerts, and a formal dispatch-to-Sub-distributor flow are explicitly deferred to a later iteration. Not visible to Customers; it's an internal Distributor/Global tool.

**SKU variants:** MatriPowder pouch sizes come from an editable, per-Distributor catalog (`pouch_catalog` — Fase E, 2026-07-12; default 100g/50g/20g/10g). MatriTablets — both "grande" (1000 ppb / 5 m³) and "chica" (1000 ppb / 2.5 m³, i.e. half a grande in dose terms) are tracked (chica was paused 2026-07-11, restored 2026-07-12 once envelope packaging had somewhere to attach to — see corrected Business Rule 35). Tablets ship in non-splittable envelopes, sizes also from an editable per-Distributor catalog (`tablet_catalog`, one independent set of sizes per tablet size — default 10/15/50 for grande). MatriTablets tracks two different things as separate Inventory variants per size: unopened envelope counts (`sobre_{count}_{grande|chica}` — purchasing/warehouse unit) and a loose-tablet pool per size (`suelta_grande`/`suelta_chica` — individual tablets from an already-opened envelope). Opening an envelope is a manual action (decrement the sobre variant, add its tablet count to the matching loose pool) — not automatic. Deleting an envelope size that still has stock tracked under it is blocked, not silently allowed.

**Decrement:** automatic, at the moment a Treatment moves to Applied. For MatriPowder, the same pouch breakdown already computed for display is subtracted from the owning Distributor's stock. For MatriTablets, only the `suelta` (loose) variant is decremented by the tablet count needed — envelope counts are never touched automatically. Stock can go negative; this is a visible signal that more was applied than was on hand, not hidden by clamping to zero.

**Manual adjustment:** the Distributor (or FreshInset Global, per the usual subtree visibility) can add/subtract quantity directly — for receiving new stock, opening an envelope, or correcting a physical count.

### Pricing

Configured per Organization, in that Organization's own currency (see "Currency" under Organization above) — **not inherited from FreshInset Global or any ancestor.** Each country Distributor defines its own pricing tables from scratch when it's activated (same pattern Wassington already follows for Argentina). This is a deliberate scope boundary: this platform is not an ERP and is not tied to invoicing/collections — pricing here exists only to give customers transparent, indicative cost visibility, not to drive accounting. Sub-distributors inherit their parent Distributor's pricing tables unless explicitly overridden at approval time.

**Pricing tables:**

| Table | Unit | Segmented by |
|---|---|---|
| Product price | currency / m³ | SKU × Volume bracket, within the Organization |
| Application service fee | currency / Treatment | Volume bracket, within the Organization |
| Generator purchase | currency / unit | Volume bracket, within the Organization |
| Generator rental | currency / day | Volume bracket, within the Organization |

> **Correction (2026-07-07):** dropped "Organization tier" as a segmentation axis — it was a leftover from the original Argentina-only model, where Tier (T1/T2/T3) stood in for "which Distributor manages this customer." That's now expressed directly by the Organization tree itself (Business Rule 14), so a separate tier field on top of it was redundant.

> **Evolved (2026-07-11):** the note above originally said a different price per Customer was handled purely via the Approver's per-Treatment override at approval time. With 50+ Customers expected under Wassington alone, that's not practical to redo by hand on every Treatment — see "Customer Pricing Override" below for the standing mechanism that replaces it. The per-Treatment override authority (Business Rule 8) still exists and still wins for a one-off exception, but the common case is now a persistent override.

**Volume brackets:** 0–600 m³ / 600–1,200 m³ / 1,200–1,800 m³ / 1,800+ m³ (default starting point — a new Distributor can adjust bracket boundaries to fit its own market when it sets up its pricing).

**Pricing resolution rule:** the Approver has full authority to set the final confirmed price at the moment of approval, regardless of the indicative price shown to the Planner. The confirmed price is stored as an immutable snapshot on the Treatment and cannot be changed after approval.

**Pricing snapshot:** when a Treatment is approved, the prices in effect at that moment are captured on the Treatment record, **in the Organization's local currency AND its USD equivalent** (using that Organization's `fx_rate_to_usd` at that exact moment — also frozen on the Treatment, not recalculated later). Future pricing changes, and future exchange-rate changes, do not affect historical Treatments. This is what lets the FreshInset Global dashboard show a stable, consolidated USD total across countries: it's summing already-frozen USD snapshots, not re-converting old local-currency amounts with today's rate.

> **Correction (2026-07-12):** the same freezing rule was missing for the MatriPowder **sachet breakdown** shown on a Treatment — it was being recomputed live from whatever the pouch-size catalog looks like *today* (see Inventory → pouch catalog), so removing a sachet size from the catalog would silently change the displayed breakdown of old Treatments that used it, even though the frozen price stayed correct. Fixed the same way as price: `pouch_breakdown` is captured on the Treatment at approval time and never recomputed afterward.

**Country-level dashboards** show their own Organization's figures in local currency (their own reality, no conversion needed). **FreshInset Global's dashboard** shows everything consolidated in USD, using each Treatment's frozen USD snapshot.

**New SKUs:** adding a new product SKU requires only a new Pricing table entry — no code changes.

**Customer Pricing Override (2026-07-11):** a Customer may have a standing negotiated price, set by whichever Organization is its immediate ancestor in the tree (the Distributor or Sub-distributor it's assigned to) — this reuses the Organization tree itself as the "who's allowed to negotiate with this Customer" mechanism, not a separate account-assignment concept. Two independent mechanisms, chosen per SKU/service fee:
- **Fixed override**: a flat $/m³ (or flat service-fee amount) that replaces the entire volume-bracket table for that SKU — for large strategic clients, where the business goal of pushing self-application means the Powder service fee is often bonified or free.
- **% discount**: reduces the standard list price by a percentage — for mid-size clients, set independently per SKU/service fee.

Small/high-collection-risk clients get neither — they simply pay standard list price, unchanged. Resolution order when computing a Customer's actual price: fixed override, if set → else % discount, if set → else standard list price.

A negotiated price may carry a **minimum volume commitment** (`minimum_commitment_m3`) — this is purely informational. The system shows commitment-vs-actual (what the Customer has in their Season Plan and what they've actually completed as Treatments); it never auto-reverts or blocks pricing on its own. Whether to keep honoring a deal a Customer is falling short on is always a human business decision.

### Documentation

Split into two categories:

**Global Documentation** (owned by FreshInset Global, visible to all — genuinely universal, not country-specific):
- Scientific Knowledge Base
- DoseRight calibration evidence

**Organization Documentation** (owned by the Organization, visible to descendants):
- Product Labels (versioned — customers always see current version)
- Safety Data Sheets (SDS)
- Generator manuals
- Application instructions
- MatriSure Kit guide
- **Regulatory registrations (SENASA, EPA, or each country's local equivalent)**

> **Correction (2026-07-03):** regulatory registrations moved from Global Documentation to Organization Documentation. They are inherently country-specific (SENASA is Argentina's regulator, not a universal one) — modeling them as "global, visible to all" was a leftover inconsistency from before this was a multi-country platform. Each Distributor-level Organization owns its own country's regulatory registrations, consistent with `ORGANIZATION_ONBOARDING.md` (uploaded any time after activation, not a blocker).

> Every document carries a version number, upload date, optional changelog note, and **language** (an Organization Documentation item can exist in the Organization's chosen display language — see Organization → Language). Previous versions are retained for audit purposes.

**Self-service, no review gate (2026-07-03):** uploading a new document version is self-service by the owning Organization's Owner, same as everything else — no external review or approval step, even for safety-relevant documents like SDS.

**No historical version snapshot on Treatments (2026-07-03):** unlike Pricing, a completed Treatment does **not** freeze which document version was current at the time — it simply always reflects the current document. This is a deliberate simplification: documents aren't part of a single Treatment's audit trail the way its price is.

### MatriSure Verification

Sub-entity of Treatment. Records the physical dose confirmation step that must occur after the treatment is applied before a Treatment can be marked Completed.

**Attributes:**

| Field | Description |
|---|---|
| photo | Image captured live from device camera (gallery upload not permitted) |
| captured_at | Timestamp auto-captured at upload — cannot be edited |
| room_tag | Cold Room automatically linked from Treatment |
| result | confirmed / not_reached / pending_review |
| reviewed_by | User who assessed the strip — see "Who can review" below |
| reviewed_at | Timestamp of review |
| assistance_requested | (2026-07-03) flag the Customer can set when uploading, if unsure of the read and wanting the Distributor/Sub-distributor above to confirm instead |
| notes | Optional free text from reviewer |

**Who can review (2026-07-03):** either the Customer's own Approver (self-confirm — the common case) **or** an Approver from the Distributor/Sub-distributor above them, when the Customer explicitly requests assistance (`assistance_requested`) because they're unsure how to read the strip. This isn't a mandatory independent-verification requirement on every Treatment — it's self-service by default, with an easy escalation path when the Customer wants a second opinion.

**Rules:**
- Photo must be taken live from device camera. Gallery upload is disabled to prevent backdating.
- A Treatment with result `not_reached` **still reaches Completed** — it is not blocked. `not_reached` is recorded and surfaced as a historical/dashboard alert, not a hard gate on closing the Treatment.
- **Fourth time-based alert (2026-07-03):** a MatriSure photo sitting in `pending_review` for too long (uploaded, but nobody — Customer or Distributor — has confirmed a result) is flagged visually on the dashboard, same style as the other three alerts defined under Treatment.
- Future roadmap: automated AI color classification of strip image (removes manual review step).

### DoseRight Decision Support Tool

Optional scientific consultation tool that assists users in selecting a dose by modelling the effect of harvest maturity parameters (flesh firmness, IEC, TSS/Brix), storage conditions (destination, atmosphere, temperature) and logistics (hours since harvest) on recommended 1-MCP concentration.

**Key design principles:**
- DoseRight provides information to support decision-making. It does not prescribe treatments.
- Final responsibility for dose selection always remains with the User.
- When a dose is confirmed in DoseRight, it is passed back to the Treatment Planner as a suggested value — the User can still modify it before submission.
- The scientific basis (calibration curves, published evidence) should be accessible to users wherever possible.

---

## Organizational Model

All commercial participants are Organizations in a hierarchical tree:

```
FreshInset Global
└── Distributor (e.g. Wassington — Argentina)
    ├── Sub-distributor (e.g. Podlesh — Río Negro)
    │   └── Customer (e.g. Frutícola Río Negro)
    └── Customer (e.g. Kleppe S.A.)
```

**Visibility rule:** Users can access their own Organization and all descendants. They cannot see peer Organizations or ancestors beyond their own.

**Pricing inheritance:** Pricing flows down the tree. The Approver at each level may set the final confirmed price at approval time for Treatments they approve.

---

## Dashboards & Reporting

**Added 2026-07-03.** Every Organization sees a dashboard scoped to itself and its descendants (same visibility rule as everything else) — what differs by level is aggregation and currency:

- **Customer** dashboard: its own Treatments, Cold Rooms, Season Plan, history.
- **Sub-distributor / Distributor** dashboard: aggregated across its own subtree, in its **own local currency** — no conversion needed, it's already looking at its own reality.
- **FreshInset Global** dashboard: consolidated across every country, **in USD**, using each Treatment's frozen USD snapshot (see Pricing → Pricing snapshot). It is **not** just one blended total — it must also **break down by country/Distributor**, so FreshInset can compare performance across geographies, not just see one aggregate number.

**Season Plan (pipeline) is shown on the same dashboard as confirmed Treatments, not a separate view** — clearly labeled/color-coded as non-binding pipeline rather than confirmed activity, so a Distributor or FreshInset gets one place to see "what's coming" and "what's confirmed" together rather than needing to check two screens.

**Season filtering is a first-class, initial-version requirement, not an afterthought.** Given the business is strongly seasonal (harvest-driven), every dashboard needs to filter by season/date-range from the start (this season vs. last season vs. full history) — retrofitting this after the underlying queries are built without it tends to be painful, so the schema needs a clean way to bucket Treatments (and Season Plans) by season from day one.

---

## Treatment Lifecycle — detailed

```
[Planner]  Draft
               ↓ submit
           Submitted
               ↓ approve (Approver confirms price)      ↓ reject (with reason)
           Approved                                   Rejected
               ↓ operator records application
           Applied  (dose, operator, generator, start/end time recorded)
               ↓ MatriSure photo uploaded + result confirmed
           Completed
```

**State transitions:**
- Draft → Submitted: Planner action
- Submitted → Approved: Approver action (price confirmed or adjusted)
- Submitted → Rejected: Approver action (reason required, visible to Planner)
- Rejected → Draft: Planner action — edits and resubmits the same record, history preserved
- Submitted → Cancelled: Planner action (before approval)
- Approved → Cancelled: Planner action (still available after approval, until the Operator records the application)
- Approved → Applied: Operator records execution details
- Applied → Completed: MatriSure photo uploaded and a result confirmed — by the Customer's own Approver (self-confirm, the common case) or, if the Customer requests assistance because they're unsure, by an Approver from the Distributor/Sub-distributor above
- Applied → Completed (not reached): reaches Completed all the same — `not_reached` is recorded and surfaced as a dashboard alert, it does not block closure
- Time-based dashboard alerts (visual only, v1): Submitted pending too long; Approved not yet Applied for too long (threshold configurable per Organization/crop); Applied with no MatriSure ever uploaded; MatriSure stuck in `pending_review`

---

## Business Rules

1. Every Organization has one parent except FreshInset Global.
2. Every Treatment belongs to exactly one Organization.
3. Every Treatment has exactly one selected dose.
4. Dose source must be recorded as Manual or DoseRight.
5. A Treatment cannot reach Completed without a MatriSure Verification record.
6. Historical Treatments are immutable after Completed.
7. Pricing confirmed at approval is stored as an immutable snapshot.
8. The Approver has final authority over the confirmed price at approval time.
9. Users can only access their Organization and its descendants.
10. Generator is required for MatriPowder treatments only.
11. MatriSure photo must be taken live from device camera — gallery upload is not permitted.
12. A Treatment with MatriSure result `not_reached` still reaches Completed — it is recorded and surfaced as an alert, not a block on closure (corrected 2026-07-03; superseded the original "requires corrective action before closure" reading).
13. Every new Organization (Distributor or Sub-distributor, at any depth) must be approved by FreshInset Global before it becomes `active` — even when created by its own parent Organization.
14. Pricing is configured per Organization in its own currency and is never inherited from FreshInset Global — only a Sub-distributor may inherit its immediate parent Distributor's pricing.
15. Each Distributor-level Organization maintains its own manually-entered exchange rate to USD; a Treatment's USD-equivalent value is frozen at approval time, alongside its price snapshot, and never recalculated.
16. Portal display language is configurable per Organization and is never a blocker to activation — an Organization may launch in an existing language and add its own translation later.
17. A User belongs to exactly one Organization — never spans multiple, unrelated Organizations.
18. Every Organization must always have at least one Owner; the last Owner of an Organization cannot be removed.
19. Replacing the Owner of a Distributor-level Organization requires FreshInset Global's approval; for Sub-distributors and Customers it is autonomous. Inviting Users and assigning Business Roles within an already-active Organization is always self-service by that Organization's Owner(s), with no external approval.
20. A Rejected Treatment returns to Draft for editing and resubmission — it is not recreated from scratch, and its history (including prior rejection reasons) is preserved.
21. A Treatment can be cancelled by the Planner any time before the Operator records its physical application — including after Approval, not only before.
22. A Season Plan and its Plan Lines are always non-binding: they never trigger Approver action, never reserve product, and are not a commitment. Converting a Plan Line into a Treatment is a one-way action that preserves a reference back to the originating Plan Line.
23. FreshInset Global's dashboard must support breaking its consolidated USD total down by country/Distributor, not only show one blended figure.
24. Season Plan (pipeline) data is shown on the same dashboard as confirmed Treatments, visually distinguished as non-binding, not on a separate screen.
25. Every dashboard supports filtering by season/date-range from the first version — this is not deferred to a later iteration.
26. Regulatory registrations belong to the country Distributor's Organization Documentation, never to FreshInset Global Documentation.
27. Uploading or versioning any document (including SDS and labels) is self-service by the owning Organization's Owner — no external review gate.
28. Treatments do not snapshot document versions — they always reflect the current version of any referenced document, unlike Pricing which is always frozen.
29. Purchasing a Generator transfers its owner Organization from the Distributor to the Customer; renting never transfers ownership.
30. A Generator dispatch covers a rental period, potentially spanning multiple Treatments — not a 1:1 dispatch-per-Treatment relationship.
31. The pre-dispatch checklist is a blocking gate: a Generator cannot be marked Dispatched with an incomplete checklist.
32. A MatriSure Verification is reviewed by the Customer's own Approver by default; the Customer may instead request assistance, escalating review to an Approver from the Distributor/Sub-distributor above.
33. A fourth time-based alert flags a MatriSure Verification stuck in `pending_review` for too long.
34. Inventory (Product SKU stock) is tracked only at the Distributor level in v1, decrements automatically when a Treatment is Applied, and is never visible to Customers.
35. MatriTablets dosing considers both "grande" and "chica" tablets (chica = half a grande in dose terms; briefly paused 2026-07-11, restored 2026-07-12); envelope counts (non-splittable purchasing units, own catalog per tablet size) and the loose-tablet pool per size (what Treatments actually consume) are tracked as separate Inventory variants — opening an envelope is always a manual action, never automatic, and is blocked if it would delete a size that still has stock.
36. A Customer Pricing Override is set by that Customer's immediate ancestor Organization (Distributor or Sub-distributor), never by the Customer itself; a fixed override always wins over a % discount, which always wins over standard list price. A minimum volume commitment attached to an override is informational only — it never automatically revokes or blocks pricing.
37. A Treatment's MatriPowder sachet breakdown is frozen at approval time, same as its price — it is never recomputed from a pouch-size catalog that may have changed since.

---

## Design Principles

1. **Self-Service First** — Customers plan Treatments, calculate costs, submit and review history with minimal intervention.
2. **Configuration over Code** — Organizations, Pricing, Documents, Currencies, Roles and Treatment options are configurable, not hardcoded.
3. **Organization-Centric Architecture** — Everything belongs to an Organization in a hierarchy. Visibility, permissions, pricing and documentation derive from this hierarchy.
4. **Treatment-Centric Business Model** — Treatment is the primary business entity. Pricing, Dose, Cold Room, Generator, Verification, History and Audit Trail all belong to the Treatment.
5. **Scientific Decision Support** — DoseRight provides scientific information to assist decisions. It does not prescribe treatments or replace professional judgment.
6. **Dose Responsibility** — Final responsibility for dose selection always remains with the User.
7. **Scientific Transparency** — Users should have access to the published scientific evidence supporting DoseRight recommendations wherever possible.
8. **Single Source of Truth** — Every business entity has one authoritative owner.
9. **Traceability by Design** — Historical Treatments are immutable and preserve the business and scientific context used when created.
10. **Incremental Evolution** — The platform evolves by extending the domain model while preserving backward compatibility wherever practical.

---

## Glossary

| Term | Definition |
|---|---|
| Organization | Business node in the hierarchy (FreshInset, Distributor, Sub-distributor, Customer). |
| Treatment | The complete operational lifecycle of a MaTri application, from planning to verified completion. |
| Treatment Planner | Workflow for creating and submitting Treatments. |
| Applied | Treatment state indicating physical execution has occurred but verification is pending. |
| MatriSure Verification | Sub-entity recording dose confirmation via color-change strip photo. |
| DoseRight Decision Support Tool | Scientific support tool. Not a prescription engine. |
| Approver | User role with authority to approve Treatments and confirm final pricing. |
| Operator | User role responsible for recording physical treatment execution and uploading MatriSure verification. |
| Pricing Snapshot | Immutable copy of prices at the moment a Treatment is approved. |
| Activity Center | Operational dashboard for Treatment management. |
| Documentation Center | Repository for documentation and scientific evidence. |
| Volume Bracket | Volume range used for pricing segmentation (XS / SM / MD / LG). |
| Generator | Individually identified equipment unit used for MatriPowder application. |
| Season Plan | Non-binding, multi-Cold-Room planning table a Customer uses to sketch out a season before committing to real Treatments. |
| Plan Line | One row of a Season Plan: a single planned Cold Room + date + dose, convertible into a Treatment. |
| FX Rate to USD | A Distributor's manually-entered exchange rate, frozen per Treatment at approval time, used to consolidate FreshInset Global's dashboard in USD. |
