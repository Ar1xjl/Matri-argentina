# ORGANIZATION_ONBOARDING.md

> Adopted 2026-07-03. Describes how a new Organization — a country Distributor (e.g. Almagrícola in Colombia) or a Sub-distributor (e.g. a new sub-distributor under an existing Distributor) — is brought into the MaTri Portal. Companion to `DOMAIN_MODEL.md` (Organization entity, Business Rules 13–14) and `SYSTEM_ARCHITECTURE.md`.

---

## Scope

This document covers onboarding **Distributors and Sub-distributors** — i.e. any new node in the Organization tree above the Customer level. It does **not** cover Customer registration, which already exists and is described in `PROJECT_SPEC.md` Section 5 (Registration flow).

The commercial process that leads to a new country or sub-distributor relationship — contracts, exclusivity terms, minimum commitments — happens outside the portal, between FreshInset and the incoming partner. This document starts where that commercial agreement ends: getting the new Organization live in the system.

---

## Why this matters for scalability

The portal doesn't compete with generic 1-MCP suppliers on price alone — it competes on **product quality, operational simplicity, price transparency, and agility.** The things that make a Distributor and its Customers actually want to operate here rather than by phone/email/spreadsheet are: Treatment history, dose consultation (DoseRight), MatriSure verification records, transparent pricing. Onboarding should get a new Organization to that value quickly, without forcing heavyweight setup — which is why the process below is deliberately lightweight (see "No mandatory checklist" below).

This is explicitly **not** an ERP and is not tied to invoicing, collections, or accounting (see `PRODUCT_PHILOSOPHY.md`) — onboarding does not involve any billing setup.

---

## Governance: every new Organization requires FreshInset Global approval

Structurally, the access-control model would allow any Organization to create another directly below it — a Distributor could create a Sub-distributor without any technical gate (see `DOMAIN_MODEL.md` → Organization → Organization status). **But by business policy, that is not allowed to happen silently.**

**Rule:** every new Organization — whether it's a new country Distributor created by FreshInset Global itself, or a new Sub-distributor created by an existing Distributor — starts in `pending` status and must be explicitly approved by FreshInset Global before it becomes `active`. This applies uniformly at every depth of the tree; there is no "self-service below the top level" exception.

This mirrors the Treatment approval pattern already in the domain model (Draft/Submitted → Approved) rather than inventing a new mechanism — consistent with "Configuration over Code" and "Single Source of Truth."

**Why FreshInset Global specifically, not just the immediate parent:** a Distributor creating its own Sub-distributor still routes to FreshInset Global for approval, not just to itself. This keeps FreshInset with full visibility over who is operating under its brand at every level, even as the tree grows across countries.

---

## What gets configured when an Organization is created

| Field | Notes |
|---|---|
| Name | e.g. "Almagrícola", "Podlesh" |
| Parent | FreshInset Global (for a new country Distributor) or an existing Distributor (for a new Sub-distributor) |
| Country | ISO code — inherited by any Sub-distributors created under it |
| Currency | Chosen by the incoming Distributor — the legal tender of the market it operates in. Not fixed to USD; Argentina/Wassington pricing in USD is that Distributor's own choice, not a platform rule (see `DOMAIN_MODEL.md` Business Rule 14) |
| Exchange rate to USD | Entered manually by the new Distributor's Owner (no external FX API). Required only if the Distributor's currency isn't already USD — this is what feeds FreshInset Global's consolidated USD dashboard (see `DOMAIN_MODEL.md` → Pricing snapshot) |
| Display language | Optional at onboarding — defaults to an existing language (Spanish/English) if the Distributor's own translation isn't ready yet. Not a blocker to activation (see below) |
| Initial Owner user | At least one User with the Owner Business Role, invited by email, so the new Organization can start configuring itself once approved |

## Pricing at onboarding

**A new Distributor defines its own pricing tables from scratch**, in its own currency — nothing is inherited or defaulted from FreshInset Global. This matches how Wassington's Argentina pricing already works today, and keeps pricing decisions local to whoever actually understands that market. A Sub-distributor, once approved, inherits its parent Distributor's pricing tables by default, with the option to override at Treatment approval time (same rule that already applies today between Wassington and Podlesh).

## No mandatory activation checklist

There is deliberately **no formal go-live checklist** (no required minimum of pricing tables configured, no required documents uploaded before the Organization can start operating). FreshInset Global's approval step is the only gate. This is a conscious choice to keep onboarding lightweight — trusting the judgment of whoever is activating the Organization, rather than adding process for its own sake.

## Regulatory documentation is not a blocker

Country-specific regulatory documentation (the equivalent of SENASA registrations for Argentina, or EPA-style registrations elsewhere) does **not** need to be uploaded before an Organization goes live. It can be added to that Organization's Documentation (see `DOMAIN_MODEL.md` → Documentation → Organization Documentation) at any point after activation, without blocking operation.

## Localization is not a blocker either

Same principle as regulatory documentation: a new country Distributor can start operating in an existing portal language (Spanish/English) and add its own local translation later — it does not delay activation. **Providing (and funding) that translation is the responsibility of the Distributor requesting it**, not FreshInset Global.

---

## Process summary

```
1. Commercial agreement reached (outside the portal, between FreshInset and the incoming partner)
        ↓
2. FreshInset Global creates the Organization record: name, parent, country, currency, initial Owner user
        ↓  status: pending
3. FreshInset Global approves the Organization
        ↓  status: active
4. The new Organization's Owner logs in and configures its own Pricing tables (from scratch, its own currency)
        ↓
5. Organization can now receive Users, Cold Rooms, Generators, and Treatments
        ↓  (Sub-distributor onboarding, if any, repeats from step 2, still routed to FreshInset Global for approval)
```

**Onboarding a Sub-distributor under an existing Distributor follows the identical process** — the only difference is the parent is that Distributor instead of FreshInset Global, and pricing is inherited by default rather than built from scratch.
