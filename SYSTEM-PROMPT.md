# Material Engagement — SYSTEM_PROMPT.md

> Plataforma educativa de identificación de estilos de aprendizaje VAK (Visual, Auditivo, Kinestésico) para el Colegio Claretiano, integrando Machine Learning e IA Generativa.

---

## Descripción General

Material Engagement es una aplicación web que identifica el estilo de aprendizaje predominante de estudiantes de educación básica privada mediante un cuestionario dinámico generado por IA y un modelo de clasificación entrenado con datos de comportamiento reales. El sistema genera preguntas multimedia (texto, imágenes y audio) a través de Gemini API, las somete a validación pedagógica por el profesor (juicio de expertos), y clasifica al estudiante según el modelo VAK utilizando XGBoost.

---

## Roles del Sistema

**Estudiante:** Se registra en la plataforma, responde el cuestionario de 10 preguntas, recibe su clasificación VAK con porcentaje de confianza y retroalimentación cualitativa generada por IA, y puede consultar su historial de evaluaciones.

**Profesor (Experto):** Revisa y valida las preguntas generadas por IA (aprueba o rechaza con motivo), asigna el estilo VAK correspondiente a cada pregunta aprobada, etiqueta resultados durante la fase piloto para construir el Ground Truth, y visualiza reportes de estilos de aprendizaje por grado.

---

## Stack Tecnológico

### Frontend
- React SPA
- Desplegado en Netlify
- Consume API REST del backend vía HTTPS

### Backend
- Express.js + TypeScript
- Desplegado en Render
- REST API con autenticación JWT propia
- RBAC (Role Based Access Control) — Estudiante / Profesor
- ORM: Sequelize o Prisma para PostgreSQL

### Base de Datos
- PostgreSQL alojado en Render
- Almacena: usuarios, cuestionarios, respuestas, preguntas validadas, resultados VAK, MLDataset con variables de comportamiento y etiquetas Ground Truth

### IA Generativa
- Gemini API (Google) — servicio único para todo el contenido generativo
  - Generación de preguntas estructuradas en formato JSON
  - Generación de imágenes ilustrativas para preguntas del estilo Visual
  - Generación de audio en español para preguntas del estilo Auditivo
  - Embeddings para control de redundancia semántica
  - Retroalimentación cualitativa personalizada del resultado VAK

### Machine Learning
- XGBoost — algoritmo de clasificación VAK
- scikit-learn — preprocesamiento (normalización, encoders)
- pandas — manipulación y limpieza del dataset
- joblib — serialización del modelo (.pkl)
- AWS Lambda — ejecución de la predicción en tiempo real (serverless)
- AWS S3 — almacenamiento versionado del modelo .pkl

### Monitoreo
- Sentry — monitoreo de errores y performance del backend (opcional para MVP)

---

## Arquitectura

```
FRONTEND (Netlify)
  React SPA
      ↕ REST API / HTTPS / JSON
BACKEND (Render)
  Express.js + TypeScript
  JWT Auth + RBAC
      ↕ ORM / SQL
  PostgreSQL (Render)

BACKEND → Gemini API (generación de contenido y embeddings)
BACKEND → AWS Lambda (POST vector de features → JSON clasificación VAK)
AWS Lambda → AWS S3 (carga modelo .pkl al arrancar)

TRAINING SERVICE (Offline, cada 3-6 meses)
  Python + XGBoost + scikit-learn + pandas
      → PostgreSQL (exportación directa MLDataset)
      → AWS S3 (sube nuevo .pkl)
```

---

## Flujo de la Aplicación

### Flujo del Estudiante
1. Se registra aceptando términos y política de privacidad.
2. Inicia sesión — el sistema valida JWT y redirige al dashboard del estudiante.
3. En el dashboard visualiza resultados anteriores, cuestionarios realizados e información personal.
4. Inicia un nuevo cuestionario — se muestra pantalla de carga mientras el sistema genera las preguntas.
5. Responde 10 preguntas de opción múltiple una a una, con barra de progreso. Las preguntas incluyen contenido multimedia según el estilo: imagen (Visual), audio (Auditivo), drag & drop (Kinestésico).
6. El frontend captura automáticamente las variables de comportamiento: tiempo por pregunta, clics, cambios de respuesta, engagement, consistencia y completitud.
7. Al finalizar, revisa y envía el cuestionario.
8. El backend arma el vector de features y hace POST a AWS Lambda.
9. Lambda predice el estilo VAK usando el modelo XGBoost cargado en memoria.
10. El backend recibe la clasificación, genera retroalimentación cualitativa con Gemini API y guarda todo en PostgreSQL.
11. El estudiante visualiza su resultado con porcentaje de confianza por estilo y descripción personalizada.

### Flujo del Profesor
1. Se registra aceptando términos y política de privacidad.
2. Inicia sesión — el sistema valida JWT y redirige al dashboard del profesor.
3. En el dashboard visualiza el conteo de preguntas pendientes, aprobadas y rechazadas.
4. Accede al listado de preguntas generadas por Gemini API pendientes de validación.
5. Revisa el detalle de cada pregunta (texto, imagen o audio) y la aprueba asignando el estilo VAK correspondiente, o la rechaza indicando el motivo.
6. Durante la fase piloto, revisa y corrige las etiquetas VAK asignadas automáticamente por puntaje simple para construir el Ground Truth del dataset de entrenamiento.
7. Visualiza reportes de distribución de estilos por grado académico.
8. Exporta reportes segmentados por grado y período para compartir con las autoridades del colegio.

### Flujo de Entrenamiento del Modelo (Offline)
1. El Training Service se conecta directamente a PostgreSQL y exporta el MLDataset etiquetado.
2. pandas limpia y preprocesa los datos. scikit-learn normaliza variables numéricas y codifica variables categóricas.
3. XGBoost entrena el clasificador con 80% entrenamiento / 20% prueba.
4. Se evalúan métricas: accuracy, F1-score por estilo VAK, matriz de confusión.
5. joblib serializa el modelo entrenado como archivo .pkl.
6. El .pkl se sube a AWS S3 con boto3.
7. AWS Lambda carga automáticamente el nuevo modelo en su próximo arranque.

---

## Variables del Modelo de Machine Learning

### Variables de Entrada (Features)

**Variables del Cuestionario:**
- Puntaje Visual (int)
- Puntaje Auditivo (int)
- Puntaje Kinestésico (int)
- Selección de opciones por pregunta (categórico)
- Tipo de contenido preferido (categórico)

**Variables de Comportamiento (capturadas por el frontend):**
- Tiempo de respuesta por pregunta (float, segundos)
- Tiempo total del cuestionario (float, segundos)
- Número de cambios de respuesta (int)
- Número de clics (int)
- Nivel de completitud (float, porcentaje)
- Nivel de engagement (float)
- Consistencia de respuestas (float)

### Variable de Salida (Output)
- Estilo de aprendizaje predominante: Visual, Auditivo o Kinestésico
- Porcentaje de confianza por estilo (float, 0-100%)
- Indicador de perfil mixto (boolean)
- Retroalimentación cualitativa generada por Gemini API

---

## Fase Piloto

Durante la fase piloto el modelo XGBoost aún no existe. El sistema opera con un clasificador temporal por puntaje simple (suma de respuestas Visual / Auditivo / Kinestésico). En paralelo, cada cuestionario completado genera un registro con todas las variables de comportamiento capturadas. El profesor revisa y valida las etiquetas asignadas automáticamente desde su panel, construyendo el Ground Truth. Una vez acumulados entre 150 y 300 registros balanceados, se ejecuta el primer entrenamiento formal del modelo.

---

## Versión Beta / Preliminar (Dataset Simulado)

Para fines de demostración y validación del funcionamiento completo de la plataforma, se construirá un dataset simulado que replique las variables de comportamiento definidas del modelo (puntajes VAK, tiempos de respuesta, clics, cambios, engagement, consistencia y completitud) con etiquetas VAK asignadas manualmente. Este dataset permitirá entrenar una versión preliminar del modelo XGBoost y demostrar el flujo de clasificación de extremo a extremo — desde el envío del cuestionario hasta la visualización del resultado VAK con porcentajes de confianza y retroalimentación cualitativa — sin depender de datos reales de estudiantes del Colegio Claretiano. Esta versión beta es exclusivamente para fines de presentación y prueba del sistema; el modelo definitivo se entrenará con datos reales recolectados durante la fase piloto.

---

## Gestión y Origen de Datos (Estrategia Híbrida)

**Datos Recolectados:** El sistema genera su propio dataset a través de la interacción directa de los estudiantes con el cuestionario. El frontend captura automáticamente todas las variables definidas del modelo y las almacena en PostgreSQL con cada sesión completada.

**Datos de Entrenamiento — Fase Piloto:** Durante la fase piloto, la plataforma opera con un clasificador temporal basado en puntaje simple. El profesor revisa y valida las etiquetas asignadas desde su panel, construyendo así el Ground Truth necesario para el primer entrenamiento del modelo XGBoost.

**Datos Generados por IA:** Gemini API provee el contenido multimedia del cuestionario — preguntas en texto, imágenes ilustrativas y audio — validado previamente por el profesor a través del juicio de expertos antes de ser incorporado al banco de preguntas en PostgreSQL.

---

## Alcance del Proyecto

### Inclusiones
- Documentación del Project Charter.
- Plan de trabajo detallado con cronograma.
- Documentación de la Gestión del Proyecto.
- Actas de reuniones con stakeholders.
- Validación por juicio experto.
- Un modelo de clasificación de estilos de aprendizaje (Visual, Auditivo, Kinestésico) entrenado desde cero mediante el algoritmo XGBoost, utilizando datos de comportamiento e interacción recolectados directamente de la plataforma durante la fase piloto.
- Aplicación web prototipo (Frontend React + Backend Express.js TypeScript + Base de datos PostgreSQL) para validación de la solución, desplegada en Netlify (frontend) y Render (backend y base de datos).

### Exclusiones
- El proyecto NO incluye la implementación de un sistema completamente productivo integrado con sistemas de gestión educativa (SIS) o plataformas LMS institucionales.
- El modelo se centrará en clasificar estilos de aprendizaje en educación básica privada (primaria y secundaria), NO en educación superior ni educación pública.
- La aplicación web es un prototipo validado para pruebas pedagógicas y NO un sistema listo para producción o para ser implementado masivamente en múltiples escuelas.
- El alcance funcional del sistema se limita exclusivamente a la identificación del estilo de aprendizaje predominante, NO incluye generación de trayectorias de aprendizaje personalizadas, análisis predictivo de rendimiento, optimización de asignación de aulas ni integración con sistemas de reporte administrativo.
- El modelo de clasificación VAK NO se construye sobre un modelo preentrenado externo — se entrena desde cero con datos propios recolectados del sistema. Para la generación de contenido multimedia sí se emplea Gemini API como servicio de IA Generativa externo.

---

## Épicas e Historias de Usuario

### EP-01 — Acceso y Perfil (HU-01 a HU-15)

| Código | Título | Rol | Prioridad | SP | Tipo |
|---|---|---|---|---|---|
| HU-01 | Registro de cuenta de estudiante | Estudiante | Alta | 3 | MVP |
| HU-02 | Aceptar términos y política de privacidad como estudiante | Estudiante | Alta | 3 | MVP |
| HU-03 | Iniciar sesión como estudiante | Estudiante | Alta | 2 | MVP |
| HU-04 | Visualizar dashboard del estudiante | Estudiante | Alta | 5 | MVP |
| HU-05 | Editar información de perfil del estudiante | Estudiante | Media | 3 | Mejora |
| HU-06 | Recuperar contraseña del estudiante | Estudiante | Media | 3 | Mejora |
| HU-07 | Cerrar sesión como estudiante | Estudiante | Media | 1 | MVP |
| HU-08 | Registro de cuenta de profesor | Profesor | Alta | 3 | MVP |
| HU-09 | Aceptar términos y política de privacidad como profesor | Profesor | Alta | 3 | MVP |
| HU-10 | Iniciar sesión como profesor | Profesor | Alta | 2 | MVP |
| HU-11 | Visualizar dashboard del profesor | Profesor | Alta | 5 | MVP |
| HU-12 | Editar información de perfil del profesor | Profesor | Baja | 3 | Mejora |
| HU-13 | Recuperar contraseña del profesor | Profesor | Media | 3 | Mejora |
| HU-14 | Cerrar sesión como profesor | Profesor | Media | 1 | MVP |
| HU-15 | Validar acceso según rol del usuario | Sistema | Alta | 3 | MVP |

### EP-02 — Cuestionario y Evaluación (HU-16 a HU-29)

| Código | Título | Rol | Prioridad | SP | Tipo |
|---|---|---|---|---|---|
| HU-16 | Recibir cuestionario generado dinámicamente | Sistema | Alta | 5 | MVP |
| HU-17 | Responder cuestionario con seguimiento de progreso | Estudiante | Alta | 5 | MVP |
| HU-18 | Seleccionar respuesta de opción múltiple | Estudiante | Alta | 3 | MVP |
| HU-19 | Visualizar imagen ilustrativa en preguntas visuales | Estudiante | Media | 3 | MVP |
| HU-20 | Reproducir audio en preguntas auditivas | Estudiante | Media | 3 | MVP |
| HU-21 | Interactuar con contenido práctico en preguntas kinestésicas | Estudiante | Media | 5 | MVP |
| HU-22 | Navegar entre preguntas del cuestionario | Estudiante | Media | 3 | MVP |
| HU-23 | Validar respuestas antes de enviar el cuestionario | Estudiante | Alta | 3 | MVP |
| HU-24 | Enviar cuestionario al finalizar | Estudiante | Alta | 3 | MVP |
| HU-25 | Visualizar confirmación de cuestionario enviado | Estudiante | Media | 2 | MVP |
| HU-26 | Visualizar plataforma correctamente en dispositivos móviles | Estudiante | Media | 5 | Mejora |
| HU-27 | Iniciar nuevo cuestionario | Estudiante | Alta | 3 | MVP |
| HU-28 | Recibir retroalimentación cualitativa del resultado | Sistema | Alta | 5 | MVP |
| HU-29 | Continuar cuestionario en curso | Estudiante | Media | 3 | MVP |

### EP-03 — Resultados y Retroalimentación (HU-30 a HU-39)

| Código | Título | Rol | Prioridad | SP | Tipo |
|---|---|---|---|---|---|
| HU-30 | Visualizar resultado de clasificación de aprendizaje | Estudiante | Alta | 5 | MVP |
| HU-31 | Visualizar informe detallado del resultado | Estudiante | Alta | 5 | MVP |
| HU-32 | Visualizar perfil mixto de aprendizaje | Estudiante | Media | 3 | MVP |
| HU-33 | Consultar historial de resultados anteriores | Estudiante | Media | 5 | MVP |
| HU-34 | Visualizar comparativo de resultados en el tiempo | Estudiante | Media | 5 | Mejora |
| HU-35 | Recibir notificación de resultado disponible | Estudiante | Media | 3 | Mejora |
| HU-36 | Visualizar resultados de estudiantes por grupo | Profesor | Alta | 5 | MVP |
| HU-37 | Consultar historial de resultados de un estudiante | Profesor | Alta | 5 | MVP |
| HU-38 | Monitorear estabilidad de clasificaciones en el tiempo | Profesor | Media | 8 | Mejora |
| HU-39 | Almacenar resultados del cuestionario en base de datos | Sistema | Alta | 5 | MVP |

### EP-04 — Validación de Contenido (HU-40 a HU-47)

| Código | Título | Rol | Prioridad | SP | Tipo |
|---|---|---|---|---|---|
| HU-40 | Visualizar listado de preguntas pendientes de revisión | Profesor | Alta | 3 | MVP |
| HU-41 | Revisar detalle de una pregunta generada | Profesor | Alta | 3 | MVP |
| HU-42 | Aprobar pregunta y asignar estilo de aprendizaje | Profesor | Alta | 5 | MVP |
| HU-43 | Rechazar pregunta generada | Profesor | Alta | 3 | MVP |
| HU-44 | Etiquetar resultados de estudiantes en fase piloto | Profesor | Alta | 5 | MVP |
| HU-45 | Visualizar historial de preguntas validadas | Profesor | Media | 3 | Mejora |
| HU-46 | Filtrar preguntas por estilo de aprendizaje | Profesor | Media | 3 | Mejora |
| HU-47 | Recibir alerta cuando la IA generativa no está disponible | Sistema | Alta | 3 | MVP |

### EP-05 — Reporte y Diagnóstico (HU-48 a HU-51)

| Código | Título | Rol | Prioridad | SP | Tipo |
|---|---|---|---|---|---|
| HU-48 | Visualizar reporte de estilos por grado académico | Profesor | Alta | 5 | MVP |
| HU-49 | Exportar reporte de resultados de estudiantes | Profesor | Media | 5 | Mejora |
| HU-50 | Visualizar estadísticas generales del cuestionario | Profesor | Media | 5 | Mejora |
| HU-51 | Filtrar reportes por período de tiempo | Profesor | Media | 3 | Mejora |

### EP-06 — Integración y Resiliencia (HU-52 a HU-55)

| Código | Título | Rol | Prioridad | SP | Tipo |
|---|---|---|---|---|---|
| HU-52 | Recibir clasificación de estilo de aprendizaje tras completar el cuestionario | Sistema | Alta | 8 | MVP |
| HU-53 | Mantener funcionalidad básica ante fallo de la IA generativa | Sistema | Alta | 5 | MVP |
| HU-54 | Recibir mensaje de error comprensible ante fallos del sistema | Sistema | Alta | 3 | MVP |
| HU-55 | Acceder a la plataforma con tiempos de respuesta aceptables | Sistema | Media | 5 | Mejora |

---

## Definition of Done (DoD)

1. El código fue revisado y aprobado por al menos un miembro del equipo.
2. La funcionalidad fue probada manualmente en los flujos principales (happy path y error path).
3. Los criterios de aceptación (Given / When / Then) fueron verificados y cumplen en su totalidad.
4. La interfaz es responsive y funciona correctamente en dispositivos móviles y desktop.
5. Los datos ingresados son validados correctamente en el frontend y backend.
6. La funcionalidad fue integrada con el backend y base de datos PostgreSQL sin errores.
7. No existen errores críticos ni advertencias en consola relacionados a la funcionalidad.
8. La historia de usuario fue demostrada y aceptada por el equipo en la sesión de revisión del sprint.

---

## Workflow de Desarrollo

### Fase 1 — Backend (Express.js + TypeScript)
- Configuración del proyecto: Express.js + TypeScript + Prisma/Sequelize + PostgreSQL.
- Implementación de autenticación JWT propia con RBAC (estudiante / profesor).
- Endpoints de gestión de usuarios (registro, login, perfil).
- Endpoints de gestión de preguntas (CRUD, validación por profesor).
- Endpoint de generación de cuestionario (integración con Gemini API).
- Endpoint de envío de respuestas y captura de variables de comportamiento.
- Endpoint de clasificación VAK (POST a AWS Lambda, fallback por puntaje simple).
- Endpoint de resultados e historial.
- Endpoints de reportes para el profesor.
- Integración con Gemini API para generación de contenido y retroalimentación cualitativa.

### Fase 2 — Frontend (React SPA)
- Configuración del proyecto React.
- Pantallas de autenticación: login, registro, recuperación de contraseña.
- Dashboard del estudiante: métricas, resultados anteriores, CTA de nuevo cuestionario.
- Flujo del cuestionario: pantalla de carga, preguntas con barra de progreso, contenido multimedia (imagen, audio, drag & drop), revisión y envío.
- Pantalla de resultado VAK: estilo predominante, porcentajes, retroalimentación cualitativa.
- Informe detallado: distribución de estilos, historial de evaluaciones, perfil mixto.
- Dashboard del profesor: métricas, acceso rápido a preguntas pendientes.
- Panel de validación: listado de preguntas, detalle, aprobación con estilo, rechazo con motivo.
- Reportes: distribución por grado, historial individual, estadísticas generales.
- Captura de variables de comportamiento durante el cuestionario (tiempos, clics, cambios).
- Responsive design para dispositivos móviles.

### Fase 3 — Entrenamiento del Modelo (Python + XGBoost)
- Configuración del entorno Python con dependencias (XGBoost, scikit-learn, pandas, psycopg2, joblib, boto3).
- Script de exportación del MLDataset desde PostgreSQL.
- Pipeline de preprocesamiento: limpieza, tratamiento de nulos, normalización, codificación categórica.
- Entrenamiento del modelo XGBoost con split 80/20.
- Evaluación de métricas: accuracy, F1-score por estilo VAK, matriz de confusión.
- Serialización del modelo con joblib (.pkl).
- Upload del .pkl a AWS S3 con boto3.
- Configuración de AWS Lambda para cargar el modelo desde S3.
- Documentación del proceso de reentrenamiento periódico (cada 3-6 meses).

---

## Institución

**Colegio Claretiano** — Educación básica privada (primaria y secundaria).