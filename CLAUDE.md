# MaTri Argentina — Portal de dosificación

Portal web/móvil para operadores de cámaras de frío en Argentina, para pedir, gestionar y verificar tratamientos de 1-MCP (MaTri). Distribuido por Wassington. Ver `PROJECT_SPEC.md` para el detalle completo de flujos y decisiones de producto.

## Stack y comandos

- React 19 + Vite 8, con Supabase real (Postgres + RLS + Auth) desde 2026-07-08 — ver sección Supabase abajo. Ya no es un mockup en memoria.
- `npm run dev` — levantar en local (necesita `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, copiando `.env.local.example`)
- `npm run build` — build de producción
- `npm run lint` — lint (correr antes de dar por terminado un cambio)
- Deploy: Vercel, auto-deploy desde `main` en GitHub. **Requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas en Vercel → Settings → Environment Variables** (Production, y Preview si se quiere que las ramas de prueba funcionen igual) — `.env.local` está gitignoreado a propósito y nunca llega a Vercel solo. Si se agrega una variable de entorno nueva a futuro, hay que sumarla ahí también y volver a hacer deploy (agregar la variable sola no alcanza, hace falta un build nuevo).

## Estructura

```
src/
├── components/
│   ├── Auth/AuthModal.jsx
│   ├── Landing/Landing.jsx       ← página pública
│   ├── Portal/
│   │   ├── Portal.jsx            ← hub de estado compartido (orders, addOrder, approveOrder, rejectOrder)
│   │   ├── Dashboard.jsx, Rooms.jsx, Orders.jsx, Calculator.jsx,
│   │   │   Generators.jsx, Documents.jsx, AppLog.jsx, ApplicationForm.jsx,
│   │   │   RoomHistory.jsx, Wassington.jsx (admin), PricingPanel.jsx, Profile.jsx
│   └── Shared/Navbar.jsx, Sidebar.jsx
├── data/pricing.js                ← motor de precios, fuente única de verdad
└── App.jsx                        ← ruteo landing / portal
```

Tres experiencias en un solo código base, según rol: landing pública, portal de cliente (8 secciones), panel admin "Wassington" (pedidos, CRM, precios).

## Reglas de negocio clave (no romper sin avisar)

- **Tiers** (T1 Wassington, T2 Podlesh, T3+ otros retailers) son table-driven: agregar tier/retailer es config, no código.
- **Tablets = siempre autoaplicación**, nunca tiene service fee. Powder sí puede tener servicio gestionado.
- **Calculadora siempre muestra 3 alternativas** (Powder exacto, Powder ajustado, Tablets) — no ocultar por segmentación.
- **MatriSure: solo cámara en vivo**, no subir de galería (evita adulterar la verificación de dosis).
- Precios siempre en USD. Brackets de volumen: 0–600 / 600–1200 / 1200–1800 / 1800+ m³.
- Para agregar un SKU nuevo: solo tocar `PRODUCT_PRICES` en `src/data/pricing.js`.

## Design system

```css
--navy: #0b4358        --lime: #b5cc2e        --lime-band: #c8d84a
--coral: #e8736a        --cream: #f5f5ee       --border: #ddddd5
```
Cards: blancas, `border-radius: 12px`, borde `0.5px solid #ddddd5`, sombra suave. Tablas con el mismo borde. Badges de estado en pills redondeadas.

## Pendiente para producción (no asumir que ya existe)

Base de datos real, autenticación real, notificaciones por email, cámara en vivo forzada para MatriSure (hoy permite galería), export PDF/Excel, negociación multi-cámara, portal para retailers T2/T3.

## Supabase

- `supabase/migrations/0001_initial_schema.sql` — esquema completo (tablas de `organizations`, `profiles`/`user_roles`, `cold_rooms`, `generators`, pricing, `season_plans`, `treatments`, `matrisure_verifications`, `documents`), mapeado 1:1 a `DOMAIN_MODEL.md`.
- `supabase/migrations/0002_rls_policies.sql` — Row Level Security: implementa la regla "veo mi organización + todo lo que cuelga debajo" con funciones helper (`current_org_id`, `is_in_subtree`, `is_global_member`, `has_role`).
- Todavía no hay proyecto de Supabase conectado (sin `.env`, sin CLI instalado). Los permisos por Rol de Negocio (Owner/Approver/Planner/Operator/Viewer) están pendientes de una segunda pasada de políticas, a diseñar junto con las pantallas reales de cada transición de Tratamiento.

## Documentos de referencia

- `PRODUCT_PHILOSOPHY.md` — visión y principios del producto (self-service, configuración sobre código, Treatment como entidad central). Empezá por acá para entender el "por qué".
- `DOMAIN_MODEL.md` — **fuente de verdad del modelo de negocio**: Organización (jerarquía multi-país), Treatment (reemplaza el concepto informal de "Pedido", con ciclo de vida Draft→Submitted→Approved→Applied→Completed), Roles de negocio (Owner/Approver/Planner/Operator/Viewer), Generador, Pricing (con snapshot inmutable), MatriSure Verification. Diseño acordado, pendiente de implementar.
- `SYSTEM_ARCHITECTURE.md` — arquitectura técnica objetivo: React habla directo con Supabase (Postgres + Row Level Security + Auth + Storage), **sin backend propio**. Este es el próximo paso de implementación.
- `ORGANIZATION_ONBOARDING.md` — cómo se incorpora un Distribuidor o Sub-distribuidor nuevo: requiere aprobación de FreshInset Global en todos los niveles, sin checklist formal de arranque, cada distribuidor define su propio pricing y moneda local (no hereda de FreshInset), documentación regulatoria no bloquea el alta.
- `PROJECT_SPEC.md` — spec del prototipo actual (React-only, sin backend) y guía de reconstrucción, incluye flujos detallados de registro/auth/pedidos tal como funcionan hoy. La Sección 14 quedó como puntero a `DOMAIN_MODEL.md`/`SYSTEM_ARCHITECTURE.md`, no la reescribas ahí.
- `MATRI_ARGENTINA_PROJECT_KNOWLEDGE.md` / `MATRI_ARGENTINA_PROJECT_KNOWLEDGE2.md` — historial de decisiones de la calculadora científica 1-MCP (`1mcp-dose-calculator.html`), otro track del proyecto con fórmulas de dosis por cultivo.
