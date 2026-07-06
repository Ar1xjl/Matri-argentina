# PRODUCT_PHILOSOPHY.md

> Adopted 2026-07-03 as the canonical product philosophy for MaTri Portal, superseding earlier generic drafts. Source: consolidated with FreshInset team feedback on the Vercel prototype.

---

## Purpose

The MaTri Portal exists to simplify the planning, execution and verification of MaTri™ treatments while providing transparent access to the scientific knowledge that supports their use.

The platform helps organizations operate more efficiently while maintaining complete traceability throughout the Treatment lifecycle — from initial planning through physical application to dose verification. It is not intended to replace technical expertise or make agronomic decisions on behalf of its users.

---

## Vision

The MaTri Portal is a self-service platform that enables customers, distributors and FreshInset to collaborate within a single digital ecosystem. The platform is designed as a multi-organization hierarchical system where visibility, pricing and permissions derive from the organizational tree. It grows by configuration rather than software customization, enabling worldwide deployment without custom development.

---

## Core Product Principles

**1. Self-Service First**
Customers should be able to plan Treatments, calculate estimated costs, submit Treatments, access documentation and review Treatment history with minimal administrative intervention.

**2. Configuration over Code**
Organizations, Pricing, Documents, Currencies, Business Roles and Treatment options should be configurable rather than hardcoded. Adding a new market, distributor or product SKU should require only configuration changes.

**3. Organization-Centric Architecture**
Everything belongs to an Organization organized in a hierarchical tree. Visibility, permissions, pricing and documentation derive from this hierarchy. Users can only access their own Organization and its descendants.

**4. Treatment-Centric Business Model**
Treatment is the primary business entity. Its lifecycle — Draft, Submitted, Approved, Applied, Completed — is the operational backbone of the platform. Pricing, Dose, Cold Room, Generator, MatriSure Verification, History and Audit Trail all belong to the Treatment.

**5. Scientific Decision Support**
DoseRight Decision Support Tool provides scientific information to assist decision-making. It does not prescribe treatments or replace professional judgment. The scientific basis for its recommendations should be accessible to users wherever possible.

**6. Dose Responsibility**
Final responsibility for dose selection always remains with the User. DoseRight suggests — the User decides.

**7. Scientific Transparency**
Whenever possible, users should have access to the published scientific evidence supporting DoseRight recommendations. The platform should make science visible, not obscure it.

**8. Single Source of Truth**
Every business entity has one authoritative owner. Pricing, documentation and Treatment records have clear ownership and a single point of update.

**9. Traceability by Design**
Historical Treatments are immutable and preserve the business and scientific context used when created. The MatriSure Verification step — live photo, timestamp, result — is a non-negotiable part of Treatment completion.

**10. Incremental Evolution**
The platform should evolve by extending the domain model while preserving backward compatibility whenever practical. New capabilities should be additive, not disruptive.

---

## What the MaTri Portal IS

- A Treatment Lifecycle Management platform (Plan → Execute → Verify)
- A self-service customer portal
- A collaborative platform for FreshInset and its commercial partners
- A scientific decision support ecosystem
- A configurable multi-organization hierarchical platform
- A traceable operational system designed for global deployment

---

## What the MaTri Portal IS NOT

- An ERP
- A CRM
- A billing platform
- A warehouse management system
- A replacement for technical advisors
- A prescription engine
- A substitute for professional agronomic judgment
- A single-market product

---

## Design Goal

Every new feature should answer:

> *Does this make planning, executing or verifying a Treatment simpler while preserving scientific transparency and customer responsibility?*

If the answer is no, the feature probably does not belong in the MaTri Portal.

---

## Long-Term Vision

Build a scalable global platform where organizations, scientific knowledge and operational execution coexist within a single ecosystem, enabling worldwide deployment through configuration rather than custom development.
