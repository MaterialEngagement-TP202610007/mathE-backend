# Cómo el motor de reglas revisó cada pregunta (explicación no técnica)

## 1. Resumen
El MVI (Motor de Validación de Ítems, el "corrector automático" de preguntas) ya revisaba cada pregunta que genera la IA (inteligencia artificial) antes de que llegue al docente. Hasta ahora solo guardaba el veredicto final. Con este cambio guarda también **cada intento**: qué texto se revisó, qué criterios no cumplió y cómo se corrigió. Además guarda **la lista completa de criterios** con los que se evaluó. Con esa información, la pantalla de detalle de la pregunta podrá mostrarle al docente todo el recorrido de forma clara.

> Por qué te importa: el docente deja de ver un simple "aprobada" y pasa a entender **por qué** el sistema confía en esa pregunta. Además, la demostración en la presentación muestra el filtro funcionando paso a paso.

## 2. El problema (antes)
Pensá en un examen corregido del que solo te devuelven la nota final, sin las correcciones en rojo ni los borradores anteriores.

Eso pasaba con el MVI:
- Si la IA necesitaba 2 o 3 intentos para lograr una buena pregunta, los errores de los primeros intentos se perdían.
- Solo quedaba el número de intentos y los problemas del último.
- El motor solo informa lo que falla, no lo que se cumple. Por eso tampoco se sabía qué criterios se habían aplicado.

## 3. Qué se hizo
1. **Se guarda la lista de criterios.** Cada vez que el motor revisa una pregunta, el sistema anota los 10 criterios vigentes: nombre, descripción, si un incumplimiento bloquea la pregunta o solo genera una observación, y el límite tolerado.
2. **Se guarda el historial de intentos.** Por cada revisión queda registrado:
   - el número de intento;
   - si fue la primera versión ("generación") o una corrección pedida a la IA ("revisión");
   - el texto y las opciones revisadas;
   - si pasó o no;
   - qué criterios no cumplió y con qué gravedad.
3. **La revalidación suma, no borra.** Cuando el docente pide volver a revisar una pregunta, se agrega un intento más al historial ("revalidación") y no se reemplaza lo anterior.
4. **Las preguntas viejas siguen funcionando.** Las preguntas creadas antes del cambio no tienen historial. La pantalla mostrará solo el diagnóstico final, con una nota aclaratoria.

Decisiones clave:
- La información se guarda dentro del mismo campo que ya existía. No se cambió la estructura de la base de datos.
- No se agregan llamadas extra a la IA ni al motor, así que el costo no cambia.
- Los estudiantes siguen sin ver ningún dato del motor.

## 4. Cómo funciona ahora
Es como el historial de cambios de un documento compartido: cada versión queda guardada junto con los comentarios del revisor.

Un ejemplo real de la prueba en local (pregunta #48, estilo visual):
- **Intento 1 (generación):** no pasó. Era difícil de leer para la edad y usaba palabras fuera del vocabulario del grado. Las dos cosas bloquean la pregunta.
- **Intento 2 (revisión):** pasó, con una sola observación leve de vocabulario.
- **Intento 3 (revalidación pedida por el docente):** volvió a pasar, con la misma observación leve.

En la interfaz, el docente verá un botón "Ver análisis del MVI" en el detalle de la pregunta. El botón abre una ventana con:
- un resumen ("El motor revisó esta pregunta en 2 intentos y la aprobó");
- la línea de tiempo de intentos, con los problemas en rojo (bloquean) o en ámbar (observaciones);
- la lista de los 10 criterios, marcados con ✓ o ✗.

## 5. Antes y después
| | Antes | Después |
|---|---|---|
| Veredicto final | Sí | Sí |
| Número de intentos | Sí | Sí |
| Problemas de cada intento | Solo del último | De todos |
| Texto de cada versión | No | Sí |
| Criterios aplicados | No | Los 10, con su descripción |
| Revalidar | Borraba lo anterior | Agrega un intento al historial |
| Preguntas viejas | — | Siguen funcionando (sin historial) |

## 6. Referencias
- Historial en la generación: `src/domain/use-cases/question/generate-question.use-case.ts`
- Revalidación que agrega intentos: `src/domain/use-cases/question/revalidate-question.use-case.ts`
- Lectura de criterios del motor: `src/infrastructure/adapters/mvi-item-validator.adapter.impl.ts`
- Formato de los datos: `src/domain/interfaces/item-validation/index.ts`
- Contrato para el frontend: `docs/FRONTEND_INTEGRATION.md`
- Seguimiento de la tarea: `odd/tasks/mvi-transparency.md`

## Glosario
- **MVI:** Motor de Validación de Ítems. Revisa automáticamente cada pregunta según reglas pedagógicas.
- **Criterio o regla:** una condición concreta, por ejemplo "el enunciado no supera cierta cantidad de palabras".
- **Bloqueante:** un incumplimiento que hace que el motor no apruebe la pregunta.
- **Observación (advertencia):** un detalle que se informa pero no impide aprobarla.
- **Intento:** cada versión de la pregunta que el motor revisó.
- **Revalidación:** volver a pasar una pregunta existente por el motor.
- **Catálogo:** la lista oficial de criterios y sus límites; tiene número de versión (hoy 0.4.0).
