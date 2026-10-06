# PrestaNeo · Finance OS

Sistema de gestión de préstamos, cobranzas y caja — Web App / PWA con React, Vite, Tailwind CSS y Supabase.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Animaciones | Framer Motion 13 |
| Backend / DB | Supabase (Postgres + Auth + Storage + RLS) |
| Exportación | jsPDF 4, docx 9, qrcode 1.5 |
| PWA | vite-plugin-pwa |
| Despliegue | Vercel |

---

## Requisitos previos

- Node.js ≥ 18 y npm ≥ 9
- Cuenta en [Supabase](https://supabase.com) con un proyecto creado
- Cuenta en [Vercel](https://vercel.com) (para producción)
- Google OAuth configurado en Supabase (ver sección de autenticación)

---

## 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/prestaneo.git
cd prestaneo
npm install
```

---

## 2. Configurar variables de entorno

Copia la plantilla y rellena los valores reales:

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Dónde encontrarlos: **Supabase Dashboard → Project Settings → API → Project URL / anon public**.

> `.env.local` está en `.gitignore` y nunca debe subirse al repositorio.

---

## 3. Aplicar las migraciones SQL en Supabase

Las migraciones están en `supabase/migrations/`. Aplícalas en orden en el **SQL Editor** de tu proyecto:

### 3.1 — Migración principal (esquema multitenant + triggers + RLS)

Copia y ejecuta el contenido de:

```
supabase/migrations/20260930032010_prestaneo_multitenant_core.sql
```

Esto crea / modifica:
- Tablas: `clientes`, `prestamos`, `cuotas`, `pagos`, `caja`
- Función RPC: `emitir_prestamo(p_cliente, p_prestamo, p_cuotas)`
- Triggers: actualización automática de cuotas y libro de caja al registrar un pago
- RLS: aislamiento completo por `owner_id = auth.uid()`
- Storage bucket: `documentos-clientes` (privado, 10 MB, JPEG/PNG/PDF)

### 3.2 — Migración de seguridad (search_path + índices adicionales)

```
supabase/migrations/20260930032144_prestaneo_search_path_fk_indexes.sql
```

### 3.3 — Eliminación permanente desde la papelera

Aplica también esta migración para habilitar la eliminación definitiva de clientes archivados:

```
supabase/migrations/20261006000000_prestaneo_eliminar_cliente_papelera.sql
```

La operación elimina sus préstamos, cuotas y ventas asociadas; conserva los importes y conceptos históricos de caja. Solo permite purgar clientes que ya estén archivados y pertenezcan al usuario autenticado.

> **Importante:** si tu proyecto Supabase ya tiene datos en las tablas, lee los comentarios al inicio del archivo core antes de ejecutar.

---

## 4. Configurar Google OAuth en Supabase

1. Ve a **Supabase Dashboard → Authentication → Providers → Google**
2. Activa el proveedor Google
3. Crea credenciales OAuth en [Google Cloud Console](https://console.cloud.google.com):
   - Tipo: **Web application**
   - Authorized redirect URIs: `https://xxxxxxxxxxxx.supabase.co/auth/v1/callback`
4. Pega el **Client ID** y **Client Secret** en Supabase
5. En Supabase → **Authentication → URL Configuration**, añade tu dominio de producción en **Site URL** y **Redirect URLs**:
   - Desarrollo: `http://localhost:5173`
   - Producción: `https://tu-app.vercel.app`

---

## 5. Ejecutar en desarrollo

```bash
npm run dev
```

La app estará disponible en `http://localhost:5173`. El login con Google redirige de vuelta a esta URL.

---

## 6. Build de producción (verificación local)

```bash
npm run build
npm run preview
```

Verifica que las rutas SPA funcionen correctamente y que el Service Worker de PWA se registre.

---

## 7. Subir a GitHub

```bash
# Inicializar git si no existe
git init
git add .
git commit -m "feat: PrestaNeo producción — Supabase real, UI/UX premium, PWA"

# Crear el repositorio en GitHub y enlazarlo
git remote add origin https://github.com/TU_USUARIO/prestaneo.git
git branch -M main
git push -u origin main
```

> Asegúrate de que `.env.local` **no** esté en el commit. El `.gitignore` ya lo excluye.

---

## 8. Desplegar en Vercel

### Opción A — Interfaz web (recomendado)

1. Ve a [vercel.com/new](https://vercel.com/new) e importa tu repositorio de GitHub
2. Vercel detecta automáticamente el framework **Vite**
3. En **Environment Variables**, añade:

   | Nombre | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` |

4. Haz clic en **Deploy**

### Opción B — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

Durante el asistente, configura las mismas variables de entorno cuando lo solicite.

### vercel.json (ya incluido)

El archivo `vercel.json` en la raíz configura:
- **Rewrite SPA**: todas las rutas apuntan a `/index.html` para evitar errores 404 al recargar
- **Headers de seguridad**: `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`
- **Cache de assets**: los bundles en `/assets/` se sirven con `Cache-Control: immutable`
- **Manifest PWA**: tipo MIME correcto para `manifest.webmanifest`

---

## 9. Configurar dominio personalizado (opcional)

1. En **Vercel → tu proyecto → Settings → Domains**, añade tu dominio
2. Actualiza **Supabase → Authentication → URL Configuration → Redirect URLs** con el nuevo dominio
3. Actualiza las **Authorized redirect URIs** en Google Cloud Console

---

## 10. Estructura del proyecto

```
prestaneo/
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   ├── pwa-192.svg
│   └── pwa-512.svg
├── src/
│   ├── lib/
│   │   ├── supabase.js          # Cliente Supabase + flag isSupabaseConfigured
│   │   └── supabaseService.js   # Capa de datos: auth, queries, RPC, mutations
│   ├── utils/
│   │   ├── loanCalculator.js    # Calculadora de interés directo con cronograma
│   │   ├── receiptPdf.js        # Generador PDF A5 con QR institucional
│   │   └── reportDocx.js        # Generador DOCX ejecutivo con portada y KPIs
│   ├── App.jsx                  # Componente raíz + todos los componentes de UI
│   ├── App.css                  # Sistema de diseño completo (Cyber-Executive Dark)
│   ├── index.css                # Variables CSS globales + fuentes
│   └── main.jsx                 # Bootstrap de React
├── supabase/
│   └── migrations/
│       ├── 20260930032010_prestaneo_multitenant_core.sql
│       └── 20260930032144_prestaneo_search_path_fk_indexes.sql
├── .env.example                 # Plantilla de variables (seguro para Git)
├── .env.local                   # Variables reales (NO subir a Git)
├── vercel.json                  # Configuración de despliegue + headers
├── vite.config.js               # Plugins: React, Tailwind, PWA, code splitting
└── index.html                   # Punto de entrada HTML
```

---

## 11. Funcionalidades

| Módulo | Descripción |
|---|---|
| **Dashboard** | KPIs en tiempo real, gráfico de rendimiento, cobros prioritarios, actividad reciente |
| **Cobranzas** | Tabla de cuotas con filtros, registro de pagos totales/parciales, contacto WhatsApp |
| **Préstamos** | Cartera activa con progreso visual, búsqueda y emisión de nuevas operaciones |
| **Clientes** | Grid con score crediticio, nivel de riesgo y contacto directo |
| **Alertas** | Cuotas vencidas o a ≤ 48hs con botones de cobro, WhatsApp y llamada |
| **Caja** | Libro de movimientos actualizado automáticamente por triggers de Supabase |
| **Comprobantes** | Recibos PDF A5 con QR y reportes Word con portada ejecutiva |
| **PWA** | Instalable en móvil, funciona offline para consulta de datos cargados |

---

## 12. Seguridad

- **RLS (Row Level Security)**: cada usuario solo accede a sus propios datos vía `auth.uid()`
- **Triggers de tenant**: los FK entre tablas verifican que pertenezcan al mismo `owner_id`
- **OAuth**: no se almacenan contraseñas; autenticación delegada a Google
- **Storage privado**: los documentos de clientes solo son accesibles con URL firmada
- **Variables de entorno**: la `anon key` es segura para el cliente (solo permite operaciones autorizadas por RLS)

---

## 13. Solución de problemas frecuentes

**"No se pudieron cargar los datos. Verifica que aplicaste las migraciones SQL"**
→ Ejecuta ambas migraciones en el SQL Editor de Supabase en el orden indicado.

**Error 404 al recargar la página en Vercel**
→ Verifica que `vercel.json` esté en la raíz del repositorio y que el rewrite esté configurado.

**El login con Google no redirige correctamente**
→ Revisa que la URL de tu app esté en **Supabase → Authentication → Redirect URLs** y en las credenciales de Google Cloud.

**"El pago excede el saldo de la cuota" (error de Supabase)**
→ El trigger de Postgres valida que el monto no supere el saldo pendiente. Recarga los datos para ver el estado actualizado.

**La PWA no se instala**
→ Asegúrate de servir desde HTTPS (Vercel lo hace automáticamente). En desarrollo, usa `npm run preview` en lugar de `npm run dev`.

---

## Licencia

Uso privado y comercial permitido para el titular del proyecto. No redistribuir sin autorización.

---

*Generado con Prestaneo Finance OS · © 2026*
