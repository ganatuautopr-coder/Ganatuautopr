# GanatuautoPR — Código completo

Proyecto básico para gestionar rifas de autos: frontend (estático) + backend (Node.js/Express) con Stripe Checkout, SQLite y SendGrid.

## Estructura
- public/ — archivos públicos (index.html, styles.css, app.js, assets/)
- server.js — servidor express
- db.js — helper sqlite
- templates/ — plantilla de correo
- .env.example — variables de entorno

## Instalación rápida (local)
1. Clonar / descomprimir el proyecto.
2. `npm install`
3. Copiar `.env.example` a `.env` y completar las variables (STRIPE keys, SENDGRID key, EMAIL_FROM, ADMIN_PASSWORD, TICKET_PRICE, TOTAL_TICKETS, DRAW_DATE, EIN).
4. Iniciar servidor:
   - `npm start`
5. Para probar webhooks localmente usa la CLI de Stripe:
   - `stripe listen --forward-to localhost:4242/webhook`

## Notas importantes
- Antes de vender boletos, verifica la legalidad de rifas en Puerto Rico.
- Cambia `ADMIN_PASSWORD` y usa HTTPS en producción.
- Usa una base de datos más robusta en producción (Postgres, MySQL).
