# MaTri Argentina — Portal de dosificación

Portal web/móvil para operadores de cámaras de frío en Argentina, para pedir, gestionar y verificar tratamientos de 1-MCP (MaTri). Distribuido por Wassington. Ver `PROJECT_SPEC.md` para el detalle completo de flujos y decisiones de producto.

## Stack y comandos

- React 19 + Vite 8, sin backend todavía (todo el estado vive en React; Supabase planeado a futuro).
- `npm run dev` — levantar en local
- `npm run build` — build de producción
- `npm run lint` — lint (correr antes de dar por terminado un cambio)
- Deploy: Vercel, auto-deploy desde `main` en GitHub.

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

## Documentos de referencia

- `PROJECT_SPEC.md` — spec completo y guía de reconstrucción, incluye flujos detallados de registro/auth/pedidos.
- `MATRI_ARGENTINA_PROJECT_KNOWLEDGE.md` / `MATRI_ARGENTINA_PROJECT_KNOWLEDGE2.md` — historial de decisiones de la calculadora científica 1-MCP (`1mcp-dose-calculator.html`), otro track del proyecto con fórmulas de dosis por cultivo.
