# Resumen de cambios MathE

| | |
|---|---|
| Fecha | 13 de septiembre de 2026 |
| Rama del código | `release` |
| Detalle técnico | `QA-REPORT-2026-09-13.md` |

Antes de la presentación se revisó la plataforma completa: el servidor, la aplicación web y los servicios externos (inteligencia artificial, almacenamiento de imágenes y clasificador de estilos). Este documento explica, sin tecnicismos, qué cambió para alumnos, profesores y administradores, y qué hay que hacer antes de la demo.

**Estado**

- **Pruebas automáticas:** 420, todas pasan. Antes de la revisión había 123.
- **Colegios en el registro:** 3.998. Antes eran 5.939 filas, porque cada colegio aparecía una vez por nivel.
- **Publicación:** la primera parte ya está subida a `release`. La unificación de colegios, el banco de preguntas por colegio y el nuevo esquema de activación de cuentas están listos, pero todavía no se subieron.

---

## Cuentas y acceso

| Tema | Antes | Ahora |
|---|---|---|
| Registro como administrador | Cualquier persona podía registrarse como administrador desde la página pública. | El registro solo permite alumno o profesor. La cuenta de administrador se crea desde la configuración del servidor. |
| Activación de alumnos | Un profesor tenía que activar a cada alumno antes de que pudiera entrar. | El alumno entra apenas se registra. No hay activación. |
| Aprobación de profesores | No había pantalla para el administrador. Al entrar veía el menú de alumno y errores. | El profesor queda pendiente hasta que un administrador lo aprueba en la nueva pantalla **Profesores**, que muestra pendientes y activos con su colegio. |
| Duración de la sesión | La sesión vencía a las 2 horas sin aviso. | La sesión dura 24 horas. |
| Datos privados | Las listas de usuarios incluían la contraseña cifrada de cada persona. | Ninguna respuesta incluye contraseñas. |
| Intentos de inicio de sesión | No había límite de intentos. | Máximo 10 intentos fallidos por correo cada 15 minutos. También se limita la generación de preguntas para cuidar la cuota de IA. |
| Cuestionarios de otros alumnos | Un alumno podía abandonar o consultar cuestionarios ajenos. | Cada alumno solo accede a los suyos. |

## Colegios

La lista viene del padrón del Ministerio de Educación, que registra cada nivel (primaria, secundaria) como una fila separada.

| Tema | Antes | Ahora |
|---|---|---|
| Colegios repetidos | "Colegio Claretiano" aparecía dos veces, una por primaria y otra por secundaria. Un profesor y un alumno del mismo colegio podían quedar en registros distintos. | Cada colegio aparece una sola vez, con sus niveles indicados. Los colegios con el mismo nombre en distritos distintos siguen separados. |
| Claretiano duplicado | Aparecían dos colegios Claretiano (San Miguel y Villa María del Triunfo), lo que podía confundir a los alumnos. | Solo aparece Claretiano de San Miguel, el colegio de la demo. Si algún alumno eligió el otro, se trasladó automáticamente a San Miguel. |
| Buscador del registro | Mostraba un código interno que no ayudaba a distinguir un colegio de otro. | Muestra nombre, distrito, dirección y niveles. |
| Colegio obligatorio | Se podía crear una cuenta sin colegio. | Alumnos y profesores deben elegir colegio y no pueden dejarlo vacío desde el perfil. |

## Banco de preguntas y cuestionario

El banco de preguntas dejó de ser uno general: ahora cada colegio tiene el suyo.

**Cómo se arma el cuestionario de un alumno.** Cada cuestionario tiene 10 preguntas, siempre con esta distribución: **4 visuales, 3 auditivas y 3 kinestésicas**.

- Si el colegio del alumno tiene esa cantidad de preguntas **aprobadas por sus propios profesores**, el cuestionario sale completo de ese banco y no aparece ninguna pregunta de respaldo.
- Si falta alguna, el cuestionario sale completo del banco de respaldo.
- **Nunca se mezclan.**

| Tema | Antes | Ahora |
|---|---|---|
| Origen de las preguntas | Las preguntas aprobadas de cualquier colegio servían para todos. | Cada pregunta pertenece al colegio del profesor que la generó y solo se usa en ese colegio. |
| Revisión de preguntas | Cualquier profesor podía aprobar o rechazar preguntas de otro colegio. | Solo los profesores del mismo colegio. |
| Variedad | Siempre salían las mismas preguntas, las más antiguas. | Se eligen al azar entre todas las aprobadas del colegio. |
| Generar preguntas con IA | El menú ofrecía 15 y 20 preguntas, que fallaban. Mientras tanto, una pantalla bloqueaba la app. | Hasta 10 por vez. Se generan en segundo plano y la app avisa cuando están listas. |

## Estabilidad durante la presentación

| Tema | Antes | Ahora |
|---|---|---|
| Terminar el cuestionario | Si fallaba un paso al final, el cuestionario quedaba cerrado sin resultado y reintentar daba error. | El alumno siempre llega a su resultado, incluso con doble clic o conexión lenta. |
| Servicios lentos | Si la IA o el clasificador no respondían, la pantalla quedaba cargando varios minutos. | Hay tiempos máximos de espera. Si no responden, se usa un cálculo local y un texto de retroalimentación predefinido. |
| Modelos de IA | La configuración usaba modelos que Google ya dio de baja. | Se usan modelos vigentes, verificados en la documentación oficial. |
| Porcentajes del resultado | La retroalimentación podía decir "Visual: 6500%". | Los porcentajes son correctos y están redondeados. |
| Servidor en reposo | Tras un rato sin uso, la primera visita mostraba una página en blanco. | Aparece "Conectando con el servidor…" y la app reintenta sola. |
| Errores | Aparecían mensajes técnicos en inglés o la pantalla se rompía. | Hay mensajes en español y una página de error con opción de volver o recargar. |
| Notificaciones en vivo | Si se cortaba la conexión, dejaban de llegar hasta recargar. | Se reconectan solas y recuperan lo pendiente. |

## Experiencia en la aplicación

| Tema | Antes | Ahora |
|---|---|---|
| Pantallas pequeñas | En tablets, celulares o proyectores de baja resolución no había menú ni botón para salir. | Hay un menú desplegable con todas las opciones. |
| Cambio de alumno en el mismo equipo | El segundo alumno veía el cuestionario a medias del primero. | Cerrar sesión limpia todo. |
| Botón "Desactivar" alumno | En realidad eliminaba al alumno, sin forma de revertirlo. | Se quitó. Queda "Eliminar", con confirmación clara. |
| Detalles visibles | El permiso de notificaciones se pedía al abrir la app, las imágenes salían recortadas, el nombre del colegio era fijo y la pestaña decía "frontend-app". | El permiso se pide al tocar la campana, las imágenes se ven completas, se muestra el colegio real y la pestaña dice "MathE". |

## Publicación en Render y Netlify

| Tema | Antes | Ahora |
|---|---|---|
| Construcción del servidor | La imagen del servidor usaba una versión de Node incompatible y no se construía. | Se usa Node 22 en el servidor y en Netlify. |
| Arranque | Cada arranque recargaba miles de colegios. Si esa carga fallaba, el servidor no levantaba. | La carga de datos es opcional y un error no impide arrancar. |
| Monitoreo | No había forma simple de saber si el servidor y la base estaban vivos. | La dirección de estado `/api/health` sirve para Render y para mantenerlo despierto. |
| Cambios en la base de datos | — | Se aplican solos al publicar. La unificación de colegios no se puede deshacer, así que hay que hacer una copia de seguridad antes. |

## Antes de la presentación

- [ ] **Copia de seguridad** de la base de datos de Render antes de publicar estos cambios.
- [ ] **Revisar la configuración de Render:** modelos de IA, datos de la cuenta administradora y dirección del clasificador. En Netlify, la variable `VITE_API_URL` debe quedar vacía.
- [ ] **Crear la cuenta de administrador** desde la configuración del servidor, con el comando `pnpm db:bootstrap-admin`.
- [ ] **Aprobar a los profesores** de la demo desde la pantalla Profesores.
- [ ] **Cargar preguntas por colegio.** Cada colegio que se muestre necesita al menos 4 visuales, 3 auditivas y 3 kinestésicas aprobadas. Si no, sus alumnos verán el cuestionario de respaldo, que no tiene imágenes.
- [ ] **Despertar el servidor** y hacer un recorrido completo unos 30 minutos antes: el profesor genera y aprueba, y el alumno responde y ve su resultado.
- [ ] **Usar el sitio publicado** para la demo. En Safari, el entorno local de desarrollo no mantiene la sesión; el sitio publicado sí.
- [ ] **No publicar cambios** durante la presentación.

## Riesgos conocidos

- **Imágenes:** Google puede dar de baja el modelo de imágenes desde el **2 de octubre de 2026**. Si pasa, las preguntas nuevas se guardan sin imagen; la app no se rompe.
- **Plan gratuito:** en el plan gratuito de Render, el primer acceso tras un rato sin uso tarda cerca de un minuto. Además, la base de datos gratuita vence a los 30 días de creada.
- **Permisos:** quedan ajustes pendientes. En algunas consultas generales un profesor puede ver datos de otros colegios, y también puede cambiar su colegio desde el perfil.
- **PDF:** exportar un reporte largo a PDF puede fallar en iPhone.
- **No probado en vivo:** la generación real de imágenes, la respuesta del clasificador y las notificaciones a través de Netlify solo pueden confirmarse en el sitio publicado.

## Decisiones tomadas

- **Sesión y cookies se mantienen como están.** Funcionan en el sitio publicado en todos los navegadores, incluido Safari. La limitación de Safari solo afecta al entorno local de desarrollo.
- **Colegios unificados en un solo registro**, en lugar de solo ocultar los duplicados. Así, profesores y alumnos del mismo colegio comparten banco de preguntas y reportes.
- **Se conserva la distribución 4 / 3 / 3**, porque el clasificador de estilos fue entrenado con ella.
- **El administrador solo ve Profesores y Perfil.** Las demás tareas administrativas siguen disponibles desde la documentación técnica de la API.
