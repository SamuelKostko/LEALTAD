# PWA + Firestore + Email (Vercel)

Este repo sirve una PWA estática y expone endpoints serverless en `/api` para:
- Leer datos de tarjeta (`GET /api/card?token=...`)
- Webhook de compra (`POST /api/webhook/purchase`)
- Admin: login simple + crear tarjeta y enviar correo (`/admin`)

## Deploy en Vercel (desde GitHub)

1. Importa el repo en Vercel.
2. En **Build & Output**:
   - Framework Preset: **Other**
   - Build Command: *(vacío)*
   - Output Directory: *(vacío)*
3. Define las variables de entorno (Project → Settings → Environment Variables).

### Variables de entorno

- `PUBLIC_ORIGIN` (opcional): `https://tu-dominio.com`
- `ADMIN_PASSWORD`: password del admin
- `SESSION_SECRET`: string largo aleatorio (para firmar la cookie)

Firestore:
- `FIREBASE_SERVICE_ACCOUNT_JSON`: contenido JSON de la service account (recomendado en Vercel)
- `FIREBASE_PROJECT_ID` (opcional)

MailerSend:
- `MAILERSEND_API_KEY`
- `MAILERSEND_SENDER_EMAIL`

Webhook:
- `WEBHOOK_SECRET` (opcional, recomendado): se valida contra header `x-webhook-secret`

Push Notifications (Web Push):
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (ejemplo: `mailto:soporte@tu-dominio.com`)

## Admin

- Abre `/admin` para entrar al panel de clientes y transacciones.
- Inicia sesión con `ADMIN_PASSWORD`.
- Genera cobros desde `/admin/qr` cuando necesites emitir un QR de transacción.

## Notas

- Para enviar correos usa MailerSend. Asegúrate de que el dominio emisor esté verificado en su panel.
- Las notificaciones push se envian por token de tarjeta cuando hay actividad de saldo (credito por compra o consumo por canje).
