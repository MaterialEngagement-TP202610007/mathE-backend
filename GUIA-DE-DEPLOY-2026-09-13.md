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
| Frontend (Netlify) | **Free**, si se cumplen las condiciones de la sección 6.1; si no, **Personal** | Free USD 0 (300 créditos/mes) · Personal USD 9/mes (1.000 créditos) | Todas las llamadas a la API pasan por Netlify y consumen créditos. La semana estimada usa ~160 créditos. Si se agotan en el plan Free, **Netlify pausa todos los sitios del equipo** hasta el próximo ciclo. |
| Gemini API | **Facturación activada** (nivel de pago) | Por uso | Con el nivel gratuito, 200 alumnos pueden agotar la cuota y el feedback saldría predefinido. |
| AWS (S3, CloudFront, Lambda) | Sin cambios | Por uso, bajo | Revisa en la sección 5 cómo mantener el clasificador caliente. |

**Costo estimado** (sin contar el uso de Gemini y AWS). Render cobra proporcional al tiempo de uso, así que una semana cuesta cerca de 7/30 del precio mensual.

| Escenario | Servidor Standard | Base Basic-1gb + 10 GB | Espacio Render | Netlify | Total aprox. |
|---|---|---|---|---|---|
| Mínimo: 1 semana | ~USD 6 | ~USD 5 | Hobby USD 0 | Free USD 0 | **~USD 11** |
| Servidor 1 semana y base el mes completo | ~USD 6 | USD 22 | Hobby USD 0 | Free USD 0 | **~USD 28** |
| Con más respaldo (7 días de recuperación) y sin riesgo en Netlify | ~USD 6 | USD 22 | Pro USD 25 | Personal USD 9 | **~USD 62** |

Confirma en el panel de Render si la cuota mensual del espacio Pro también se prorratea. Al terminar se puede bajar de plan (sección 9).

### Región

- El servidor y la base deben estar en la **misma región**. Si se crea algo desde cero, elige **Virginia (US East)**: de las regiones de Render (Oregon, Ohio, Virginia, Frankfurt, Singapur), es la más cercana a Lima.
- Deja el bucket de S3, CloudFront y la Lambda en `us-east-1`, que es el valor por defecto de `AWS_REGION`.
- La región de un servicio de Render no se cambia después de crearlo. Como el servidor ya existe, la base nueva se crea **en la región del servidor**. Recrear el servidor en otra región cambiaría su URL y habría que actualizar `netlify.toml`; no vale el riesgo para esta semana.

### Una sola instancia

Mantén el servidor en **1 instancia** y **sin autoescalado**. Las notificaciones en vivo y los límites de intentos se guardan en la memoria del servidor; con 2 o más instancias, las notificaciones no llegan a quien corresponde. Standard con 1 instancia cubre esta carga.

---

## 2. Antes de tocar producción

- [ ] **Subir el código.** La última tanda de cambios (colegios unificados, banco de preguntas por colegio, activación de cuentas, Claretiano duplicado) debe estar commiteada y pusheada en la rama que despliega Render y Netlify.
- [ ] **Decidir la región.** Revisa en Render → servidor actual → *Settings* en qué región está. La base nueva debe crearse **en esa misma región** (sección 3).

> **Base de datos definitiva desde cero.** Los datos que hay hoy en producción son de una demo anterior y se descartan. No hace falta copiarlos ni migrarlos: se crea una base nueva y vacía, y el primer deploy la prepara sola (tablas, colegios y administrador). A partir del primer alumno registrado, **esta base pasa a ser la importante** y aplica todo lo de la sección 8.

---

## 3. Base de datos en Render (nueva)

1. Crea la base en **https://dashboard.render.com/new/database**:

   | Campo | Valor |
   |---|---|
   | Name | `mathe-db` (o similar) |
   | Region | **La misma que el servidor** |
   | PostgreSQL Version | 16 |
   | Compute Plan | **Basic-1gb** |
   | Storage | **10 GB** (se puede ampliar, no reducir) |
   | Storage Autoscaling | Activado |

2. Cuando esté disponible, copia la **Internal Database URL** (*Info*). Es la que usará el servidor: es más rápida y no sale a internet.
3. Verifica que aparezca la sección *Recovery / Backups*:
   - Recuperación a un momento pasado: los últimos 3 días en Hobby, 7 días en Pro.
   - Copias lógicas: se guardan 7 días en cualquier plan de pago.
4. **La base anterior** (la de la demo) no se toca hasta terminar la prueba de la sección 7. Recién entonces bórrala desde Render → esa base → *Settings → Delete Database*, para no pagarla ni confundir conexiones.

---

## 4. Servidor en Render

### 4.1 Configuración del servicio

| Opción | Valor |
|---|---|
| Runtime | Docker (usa el `Dockerfile` del repo) |
| Rama | la rama con los cambios (`release` o `main` después de mergear) |
| Instance type | **Standard** |
| Instancias | **1** (sin autoescalado) |
| Región | La del servidor actual; la base debe estar en la misma |
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

### 4.3 Primer arranque sobre la base nueva

1. En *Environment* del servidor configura, antes de desplegar:
   - `DATABASE_URL`: Internal Database URL de la base **nueva**.
   - `RUN_SEED`: `true`.
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
   - `JWT_SEED`: uno **nuevo**. Así se invalidan las sesiones de la demo anterior.
2. Despliega (*Manual Deploy → Deploy latest commit*) y revisa los logs. Deben aparecer, en este orden:
   - las 12 migraciones aplicadas;
   - `Seeded 3 roles`, `Seeded 11 academic grades`, `Seeded schools: 3998 inserted`;
   - `Admin <correo> created`;
   - el mensaje de servidor iniciado.
3. Abre `https://<servicio>.onrender.com/api/health`. Debe responder `{"status":"ok","db":"up"}`.
4. Inicia sesión en el sitio de Netlify con el administrador.
5. Vuelve a poner `RUN_SEED=false` y guarda. No hace falta redesplegar por eso; aplica en el siguiente reinicio.
6. Si el administrador no se creó (por ejemplo, porque faltaba una variable), créalo desde **Shell** con `pnpm db:bootstrap-admin`. Shell está disponible en instancias de pago.

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
| Plan | **Free** (ver 6.1) o **Personal** |
| Rama | la misma que el backend |
| Build command | `pnpm run build` |
| Publish directory | `dist` |
| `NODE_VERSION` | `22` (ya definido en `netlify.toml`) |
| `VITE_API_URL` | **No definir.** Si existe, bórrala. Con ella las cookies dejan de funcionar en Safari. |
| Proxy | `netlify.toml` → `/api/*` hacia `https://mathe-backend-1cqc.onrender.com`. Si la URL del servicio de Render cambia, actualízala ahí y vuelve a desplegar. |

Después de cambiar variables, usa **Clear cache and deploy site**.

### 6.1 ¿Alcanza el plan Free?

Estimación para 200 alumnos, ~1 hora diaria cada uno durante 5 días:

| Consumo | Cálculo | Créditos |
|---|---|---|
| Llamadas a la API | ~250 llamadas por hora conectada (el aviso de notificaciones consulta cada 30 s y la conexión en vivo se renueva cada ~26 s) × 1.000 horas ≈ 300.000 llamadas. Netlify cobra 2 créditos cada 10.000. | ~60 |
| Transferencia | La app (~0,6 MB por primera carga, luego queda en caché) más las respuestas de la API ≈ 1 GB, a 20 créditos por GB. Las imágenes salen de CloudFront y no cuentan. | ~20 |
| Publicaciones | 15 créditos cada deploy; ~5 deploys de preparación | ~75 |
| **Total** | | **~155 de 300** |

**El plan Free alcanza si se cumplen estas condiciones:**

- [ ] En **Netlify → Usage**, los créditos ya usados este mes dejan margen: al menos **150 disponibles**. Los créditos se comparten entre todos los sitios del equipo y no se acumulan de un mes a otro.
- [ ] Hay **pocos deploys**. Desactiva *Deploy Previews* y *Branch deploys* en *Build & deploy*, y no publiques durante la semana. Cada deploy cuesta 15 créditos.
- [ ] Alguien revisa **Usage** cada día. Si el consumo pasa del **70 %**, sube a Personal ese mismo día.

Si no se cumplen, usa **Personal**: con el plan Free, al agotarse los créditos Netlify **pausa todos los sitios del equipo** y los alumnos ven "Site not available" hasta el siguiente ciclo.

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
- [Netlify — How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- [Netlify Free Plan Limits 2026 (Netli.fyi)](https://netli.fyi/blog/netlify-free-plan-limits-2026)
