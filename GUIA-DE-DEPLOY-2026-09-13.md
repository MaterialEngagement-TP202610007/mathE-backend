# Guía de deploy MathE — Semana de uso con alumnos

| | |
|---|---|
| Fecha | 13 de septiembre de 2026 |
| Uso previsto | 1 semana, ~200 alumnos del Colegio Claretiano (San Miguel) |
| Backend | Render (Docker) + Render Postgres |
| Frontend | Netlify (proxy `/api/*` hacia Render) |
| Servicios externos | Gemini API, AWS S3 + CloudFront, AWS Lambda (clasificador XGBoost) |
| Prioridad | **Proteger los datos de los alumnos** y responder rápido |

> Los precios y límites de este documento se tomaron de las páginas oficiales de Render y Netlify en septiembre de 2026. Confírmalos en el panel antes de pagar, porque pueden cambiar.

---

## 1. Plan recomendado

| Pieza | Plan recomendado | Precio de lista | Por qué |
|---|---|---|---|
| Servidor (Render Web Service) | **Standard** — 1 CPU, 2 GB RAM | USD 25/mes | No se duerme y tiene margen para picos de 30–60 alumnos terminando cuestionarios a la vez. Starter (0,5 CPU, 512 MB, USD 7) queda justo. |
| Base de datos (Render Postgres) | **Basic-1gb** + 5–10 GB de disco | USD 19/mes + USD 0,30 por GB/mes | Es de pago, así que incluye copias de seguridad. La gratuita **vence a los 30 días** y no tiene copias. |
| Espacio de trabajo en Render | **Pro** (recomendado) o Hobby | Pro USD 25/mes · Hobby USD 0 | Pro permite recuperar la base a cualquier momento de los **últimos 7 días**; Hobby, solo de los últimos 3. |
| Frontend (Netlify) | **Personal** | USD 9/mes (1.000 créditos) | Todas las llamadas a la API pasan por Netlify y consumen créditos. Los 300 créditos del plan gratuito pueden no alcanzar la semana. |
| Gemini API | **Facturación activada** (nivel de pago) | Por uso | Con el nivel gratuito, 200 alumnos pueden agotar la cuota y el feedback saldría predefinido. |
| AWS (S3, CloudFront, Lambda) | Sin cambios | Por uso, bajo | Revisa en la sección 5 cómo mantener el clasificador caliente. |

**Costo estimado:** entre USD 55 (Render en Hobby) y USD 80 (Render en Pro) por mes, más el uso de Gemini y AWS. Render cobra de forma prorrateada, así que usarlo una semana cuesta menos que el mes completo. Al terminar, se puede bajar de plan (sección 9).

### Región

- Crea el servidor y la base en la **misma región**: **Virginia (US East)**. De las regiones de Render (Oregon, Ohio, Virginia, Frankfurt, Singapur), es la más cercana a Lima.
- Deja el bucket de S3, CloudFront y la Lambda en `us-east-1`, que es el valor por defecto de `AWS_REGION`.
- La región de un servicio de Render no se cambia después de crearlo. Si hoy el servidor y la base están en regiones distintas, crea el que falte en Virginia.

### Una sola instancia

Mantén el servidor en **1 instancia** y **sin autoescalado**. Las notificaciones en vivo y los límites de intentos se guardan en la memoria del servidor; con 2 o más instancias, las notificaciones no llegan a quien corresponde. Standard con 1 instancia cubre esta carga.

---

## 2. Antes de tocar producción

- [ ] **Subir el código.** La última tanda de cambios (colegios unificados, banco de preguntas por colegio, activación de cuentas, Claretiano duplicado) debe estar commiteada y pusheada en la rama que despliega Render y Netlify.
- [ ] **Hacer una copia de seguridad de la base actual**, aunque tenga solo datos de prueba. Se hace desde tu computadora con la **External Database URL** que aparece en Render → base de datos → *Info*:
  ```bash
  pg_dump "<EXTERNAL_DATABASE_URL>" --format=custom --file=mathe-antes-deploy-$(date +%Y%m%d-%H%M).dump
  ```
- [ ] **Confirmar la fecha de creación de la base.** Si es la gratuita, vence a los 30 días. Pásala a un plan de pago (sección 3) antes de que empiecen los alumnos.

> **Importante:** al publicar se ejecutan tres migraciones automáticas. Unifican los colegios (no se puede deshacer), activan a los alumnos pendientes y quitan el Claretiano de Villa María del Triunfo. Por eso la copia de seguridad es obligatoria.

---

## 3. Base de datos en Render

1. Si la base actual es gratuita, cámbiale el tipo de instancia a **Basic-1gb** desde *Info → Instance Type* (o *Update*).
   - Si Render no permite cambiarla, crea una base nueva **Basic-1gb en Virginia**.
   - Restaura en ella la copia del paso 2: `pg_restore --no-owner --dbname "<EXTERNAL_URL_NUEVA>" archivo.dump`.
   - Después apunta el servidor a la base nueva.
2. Asigna **5–10 GB** de disco. Sobra para una semana y el disco se puede ampliar después.
3. Verifica que las copias de seguridad aparezcan en *Recovery / Backups*:
   - Recuperación a un momento pasado: los últimos 3 días en Hobby, 7 días en Pro.
   - Copias lógicas: se guardan 7 días en cualquier plan de pago.
4. Copia la **Internal Database URL** para el servidor. Es más rápida y no sale a internet.

---

## 4. Servidor en Render

### 4.1 Configuración del servicio

| Opción | Valor |
|---|---|
| Runtime | Docker (usa el `Dockerfile` del repo) |
| Rama | la rama con los cambios (`release` o `main` después de mergear) |
| Instance type | **Standard** |
| Instancias | **1** (sin autoescalado) |
| Región | **Virginia** (igual que la base) |
| Health Check Path | `/api/health` |
| Auto-Deploy | **Desactivado durante la semana**, para que un push no reinicie el servidor en plena clase |

El contenedor ejecuta `start.sh`, que aplica las migraciones (`prisma migrate deploy`) y arranca el servidor. No hace falta un comando de build ni de inicio aparte.

### 4.2 Variables de entorno

**Obligatorias**

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Internal Database URL de Render |
| `JWT_SEED` | Cadena aleatoria de 32+ caracteres (`openssl rand -hex 32`). No uses la del template. |
| `GEMINI_API_KEY` | Clave de un proyecto con facturación activa |
| `CORS_ORIGIN` | URL exacta del sitio de Netlify, sin barra final (ej. `https://mathe.netlify.app`) |

**Recomendadas para esta semana**

| Variable | Valor |
|---|---|
| `GEMINI_CHAT_MODEL` | `gemini-3.6-flash` |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` |
| `GEMINI_EMBEDDING_DIMENSIONS` | `768` |
| `GEMINI_IMAGE_MODEL` | `gemini-2.5-flash-image` (Google puede darlo de baja desde el 2 de octubre de 2026) |
| `LAMBDA_URL` | URL del clasificador (`.../predict`) |
| `LAMBDA_TIMEOUT_MS` | `7000` |
| `GEMINI_FEEDBACK_TIMEOUT_MS` | `8000` |
| `SESSION_TTL_HOURS` | `24` |
| `QUESTION_GENERATION_CONCURRENCY` | `2` |
| `QUESTION_MAX_GENERATION_ATTEMPTS` | `3` |
| `AWS_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_DOMAIN` | Credenciales y dominio de imágenes |
| `RUN_SEED` | `true` **solo en el primer deploy sobre una base vacía**; luego `false` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Datos del administrador. La contraseña debe tener solo letras y números, mínimo 8. |

**No configures** `PORT`: Render la asigna solo.

> `LAMBDA_TIMEOUT_MS` + `GEMINI_FEEDBACK_TIMEOUT_MS` deben sumar menos de 20 s, porque Netlify corta las llamadas a los ~26 s.

### 4.3 Primer arranque

1. Despliega y revisa los logs. Tienen que aparecer las migraciones aplicadas y luego el mensaje de servidor iniciado.
2. Abre `https://<servicio>.onrender.com/api/health`. Debe responder `{"status":"ok","db":"up"}`.
3. Crea el administrador desde **Shell** (disponible en instancias de pago):
   ```bash
   pnpm db:bootstrap-admin
   ```
4. Si la base estaba vacía, confirma que el seed cargó los colegios y vuelve a poner `RUN_SEED=false`.

---

## 5. Servicios externos

### Gemini

- Activa la facturación en el proyecto de Google AI Studio o Google Cloud de la clave.
- Revisa los límites por minuto del nivel asignado. Cada alumno que termina un cuestionario hace 1 llamada de feedback. Generar preguntas hace varias llamadas por pregunta (texto, embedding e imagen).
- Genera las preguntas **antes** de la semana, no durante las clases.

### Clasificador (AWS Lambda)

- Si la Lambda tarda más de 7 s (arranque en frío), el resultado se calcula con el método simple, sin XGBoost.
- Para que use XGBoost durante las clases:
  - Configura **Provisioned Concurrency = 1** en la Lambda durante la semana, **o**
  - Crea una regla de **EventBridge** que la invoque cada 5 minutos.
- Verifica un resultado real: en la tabla `Result`, `classifierType` debe decir `xgboost`.

### S3 y CloudFront

- El bucket debe tener **Block Public Access** activo y una política que permita leer solo a CloudFront (OAC).
- La clave IAM del servidor necesita `s3:PutObject` sobre el bucket.
- Prueba: genera una pregunta y confirma que la imagen carga desde el dominio de CloudFront.

---

## 6. Frontend en Netlify

| Opción | Valor |
|---|---|
| Plan | **Personal** |
| Rama | la misma que el backend |
| Build command | `pnpm run build` |
| Publish directory | `dist` |
| `NODE_VERSION` | `22` (ya definido en `netlify.toml`) |
| `VITE_API_URL` | **No definir.** Si existe, bórrala. Con ella las cookies dejan de funcionar en Safari. |
| Proxy | `netlify.toml` → `/api/*` hacia `https://mathe-backend-1cqc.onrender.com`. Si la URL del servicio de Render cambia, actualízala ahí y vuelve a desplegar. |

Después de cambiar variables, usa **Clear cache and deploy site**.

---

## 7. Prueba completa antes de abrir a los alumnos

Hazla sobre el sitio publicado, idealmente en Chrome y en Safari (Mac o iPhone).

1. `https://<sitio-netlify>/api/health` → `{"status":"ok","db":"up"}`.
2. Recarga una dirección interna (ej. `/dashboard`) y confirma que no da 404.
3. En el registro, busca "claretiano": debe aparecer **un solo** resultado (San Miguel).
4. Registra un profesor del Claretiano, apruébalo como administrador en **Profesores** e inicia sesión como ese profesor.
5. Genera preguntas y aprueba al menos **4 visuales, 3 auditivas y 3 kinestésicas**. Mejor si son más, para que haya variedad entre alumnos.
6. Registra un alumno del Claretiano: debe entrar sin activación.
7. Como alumno, responde un cuestionario. Las preguntas deben ser del banco del colegio (con imágenes) y al final debe aparecer el resultado.
8. En la base, confirma que el `Result` tiene `classifierType = xgboost` y `feedbackSource = gemini`.
9. Cierra sesión y entra con otro alumno en el mismo navegador: no debe quedar nada del anterior.
10. Borra o identifica claramente estas cuentas de prueba antes de abrir a los alumnos, para no mezclar datos.

---

## 8. Durante la semana

### Monitoreo diario

| Qué mirar | Dónde | Señal de alerta |
|---|---|---|
| CPU y memoria | Render → servicio → *Metrics* | CPU sostenida > 80 % o memoria > 1,6 GB |
| Errores | Render → *Logs* (buscar `500`, `Unhandled`, `timeout`) | Muchos `504` al terminar cuestionarios |
| Base de datos | Render → base → *Metrics* | Disco > 70 % o conexiones al máximo |
| Cuota de Gemini | Google AI Studio / Cloud Console | Errores `429` o `feedbackSource = predefined` frecuente |
| Créditos de Netlify | Netlify → *Usage* | Consumo > 70 % de los créditos |
| Clasificador | Tabla `Result` | Muchos `classifierType = simple_score` |

### Protección de los datos (lo más importante)

1. **Copia diaria propia**, además de las copias de Render. Al final de cada día:
   ```bash
   pg_dump "<EXTERNAL_DATABASE_URL>" --format=custom --file=mathe-$(date +%Y%m%d).dump
   ```
   Guarda cada archivo en al menos **dos lugares** (por ejemplo, Google Drive institucional y un disco externo).
2. **Comprueba una copia** a mitad de semana restaurándola en una base local:
   ```bash
   createdb mathe_check && pg_restore --no-owner --dbname mathe_check mathe-AAAAMMDD.dump
   ```
3. **Nunca ejecutar en producción:**
   - `prisma migrate reset`
   - `prisma db push --force-reset`
   - `RUN_SEED=true` sobre una base con datos
   - borrados manuales de tablas
4. **No desplegar código** durante la semana, salvo una corrección urgente. Si hay que hacerlo, primero haz una copia manual y hazlo fuera del horario de clases.
5. **Acceso restringido:** solo 1–2 personas con acceso al panel de Render y a la cuenta administradora. No compartas `DATABASE_URL` por chat.

### Datos que se recolectan

| Tabla | Contenido |
|---|---|
| `User` | Alumnos y profesores (con colegio y grado) |
| `Questionnaire` y `Answer` | Cada cuestionario y cada respuesta, con tiempos y cambios |
| `MLDataset` | Variables calculadas por cuestionario (insumo del modelo) |
| `Result` | Estilo predominante, probabilidades, clasificador usado y feedback |

Exportación a CSV para análisis, desde `psql` con la External URL:

```sql
\copy (SELECT * FROM "MLDataset") TO 'mldataset.csv' CSV HEADER
\copy (SELECT * FROM "Result") TO 'results.csv' CSV HEADER
\copy (SELECT * FROM "Answer") TO 'answers.csv' CSV HEADER
```

---

## 9. Al terminar la semana

1. Haz una **copia final** (`pg_dump`) y la **exportación a CSV**, y verifica que se puedan abrir.
2. Guarda las copias en los dos lugares acordados.
3. Recién después, si quieren bajar costos:
   - Servidor: pasar a Starter o suspender el servicio.
   - Netlify: volver al plan gratuito.
   - Lambda: quitar Provisioned Concurrency.
   - **Base de datos: no la bajes al plan gratuito**, porque vence a los 30 días y no tiene copias. Mantenla de pago mientras los datos se sigan usando, o elimínala solo después de confirmar que las copias restauran bien.

---

## 10. Si algo falla durante una clase

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "Conectando con el servidor…" por más de un minuto | Servidor caído o reiniciando | Revisa Render → *Events/Logs*. Si sigue caído, usa *Manual Deploy → Restart*. |
| El alumno no ve su resultado al terminar | Clasificador o Gemini lentos | La app reintenta y recupera el resultado sola. Pide al alumno que espere y no cierre la pestaña. |
| El cuestionario sale sin imágenes | El colegio no tiene suficientes preguntas aprobadas y se usó el banco de respaldo | Aprueba más preguntas del Claretiano: 4 visuales, 3 auditivas y 3 kinestésicas como mínimo. |
| "Demasiados intentos" al iniciar sesión | 10 intentos fallidos en 15 minutos con ese correo | Espera 15 minutos o revisa la contraseña (solo letras y números). |
| Un profesor no puede entrar | Cuenta pendiente de aprobación | El administrador lo aprueba en **Profesores**. |
| Datos perdidos o dañados | — | **No toques la base.** Restaura desde Render (*Recovery*, crea una base nueva a un momento anterior) o desde la última copia diaria, y apunta el servidor a esa base. |

---

## Fuentes

- [Render — Free instance limits](https://render.com/docs/free)
- [Render — Postgres backups and recovery](https://render.com/docs/postgresql-backups)
- [Render — Regions](https://render.com/docs/regions)
- [Render pricing 2026 (G2)](https://www.g2.com/products/render-render/pricing)
- [Render Postgres flexible plans (bex.co)](https://bex.co/blog/2026/09/11/render-postgres-flexible-plans-vs-self-hosted-cost)
- [Netlify pricing](https://www.netlify.com/pricing/)
