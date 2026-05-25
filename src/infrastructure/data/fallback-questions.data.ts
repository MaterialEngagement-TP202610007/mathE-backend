import { FallbackQuestionTemplate } from "../../domain/interfaces/questionnaire/index.js";

/**
 * Local fallback question bank.
 * Used when the DB does not have enough approved questions for a given VAK style.
 * Contains 5 questions per style (15 total) to ensure the 4-3-3 distribution is
 * always satisfiable even with zero AI-generated questions.
 *
 * IMPORTANT: options include vakValue for internal DB storage; this field is
 * NEVER returned to the frontend.
 */
export const FALLBACK_QUESTIONS: FallbackQuestionTemplate[] = [
  // ─── VISUAL (5) ──────────────────────────────────────────────
  {
    statement:
      "Cuando aprendes algo nuevo, ¿qué prefieres hacer primero?",
    contentType: "text",
    vakStyle: "Visual",
    options: [
      { text: "Ver un diagrama o esquema que explique el concepto", vakValue: "V" },
      { text: "Escuchar a alguien que te lo explique en voz alta", vakValue: "A" },
      { text: "Intentarlo directamente con un ejercicio práctico", vakValue: "K" },
      { text: "Leer una guía visual con imágenes paso a paso", vakValue: "V" },
    ],
  },
  {
    statement:
      "Para recordar información importante, ¿cuál es tu estrategia habitual?",
    contentType: "text",
    vakStyle: "Visual",
    options: [
      { text: "Hacer mapas mentales o esquemas con colores", vakValue: "V" },
      { text: "Repetir en voz alta lo que quieres memorizar", vakValue: "A" },
      { text: "Escribir la información varias veces en papel", vakValue: "K" },
      { text: "Crear resúmenes con tablas y diagramas visuales", vakValue: "V" },
    ],
  },
  {
    statement:
      "¿Cómo prefieres que te expliquen un proceso complicado?",
    contentType: "text",
    vakStyle: "Visual",
    options: [
      { text: "Con una infografía o mapa conceptual", vakValue: "V" },
      { text: "Haciéndolo yo mismo con guía paso a paso", vakValue: "K" },
      { text: "Con una explicación oral detallada", vakValue: "A" },
      { text: "Con un video que muestre el proceso visualmente", vakValue: "V" },
    ],
  },
  {
    statement:
      "Al estudiar para un examen, ¿qué material te resulta más útil?",
    contentType: "text",
    vakStyle: "Visual",
    options: [
      { text: "Grabaciones de audio o podcasts del tema", vakValue: "A" },
      { text: "Presentaciones con gráficos e imágenes", vakValue: "V" },
      { text: "Ejercicios prácticos y simulacros de examen", vakValue: "K" },
      { text: "Resúmenes visuales con tablas y esquemas", vakValue: "V" },
    ],
  },
  {
    statement:
      "En clase, ¿qué actividad te ayuda más a entender un tema nuevo?",
    contentType: "text",
    vakStyle: "Visual",
    options: [
      { text: "Observar una presentación con diapositivas y gráficos", vakValue: "V" },
      { text: "Participar en una discusión grupal", vakValue: "A" },
      { text: "Realizar una actividad práctica o experimento", vakValue: "K" },
      { text: "Ver un video explicativo sobre el tema", vakValue: "V" },
    ],
  },

  // ─── AUDITORY (5) ────────────────────────────────────────────
  {
    statement:
      "Cuando tienes que aprender una nueva habilidad, ¿qué haces?",
    contentType: "text",
    vakStyle: "Auditory",
    options: [
      { text: "Pides que alguien te lo explique verbalmente", vakValue: "A" },
      { text: "Buscas tutoriales visuales o guías con imágenes", vakValue: "V" },
      { text: "Lo practicas directamente hasta que te salga bien", vakValue: "K" },
      { text: "Escuchas grabaciones o podcasts sobre el tema", vakValue: "A" },
    ],
  },
  {
    statement:
      "Para preparar una exposición, tu estrategia principal es...",
    contentType: "text",
    vakStyle: "Auditory",
    options: [
      { text: "Practicar frente al espejo o con objetos de apoyo", vakValue: "K" },
      { text: "Leer tus apuntes en voz alta repetidamente", vakValue: "A" },
      { text: "Crear tarjetas visuales con puntos clave", vakValue: "V" },
      { text: "Explicárselo a un amigo para practicar de viva voz", vakValue: "A" },
    ],
  },
  {
    statement:
      "¿Qué tipo de contenido te resulta más fácil de comprender?",
    contentType: "text",
    vakStyle: "Auditory",
    options: [
      { text: "Conversaciones o debates sobre el tema", vakValue: "A" },
      { text: "Infografías y esquemas visuales", vakValue: "V" },
      { text: "Talleres prácticos donde puedas participar activamente", vakValue: "K" },
      { text: "Conferencias y explicaciones orales detalladas", vakValue: "A" },
    ],
  },
  {
    statement:
      "Cuando trabajas en equipo, prefieres...",
    contentType: "text",
    vakStyle: "Auditory",
    options: [
      { text: "Usar pizarras o esquemas para organizar las ideas", vakValue: "V" },
      { text: "Discutir las ideas en voz alta entre todos", vakValue: "A" },
      { text: "Dividir tareas y ejecutarlas directamente", vakValue: "K" },
      { text: "Hacer una lluvia de ideas hablando en grupo", vakValue: "A" },
    ],
  },
  {
    statement:
      "Para solucionar un problema difícil, normalmente tú...",
    contentType: "text",
    vakStyle: "Auditory",
    options: [
      { text: "Experimentas con diferentes soluciones prácticas", vakValue: "K" },
      { text: "Hablas sobre el problema con alguien de confianza", vakValue: "A" },
      { text: "Haces un diagrama para visualizar el problema", vakValue: "V" },
      { text: "Te explicas el problema a ti mismo en voz alta", vakValue: "A" },
    ],
  },

  // ─── KINESTHETIC (5) ─────────────────────────────────────────
  {
    statement:
      "¿Cómo aprendes mejor algo que requiere técnica o destreza?",
    contentType: "text",
    vakStyle: "Kinesthetic",
    options: [
      { text: "Practicándolo repetidamente hasta dominarlo", vakValue: "K" },
      { text: "Observando videos o demostraciones visuales", vakValue: "V" },
      { text: "Escuchando instrucciones detalladas de un experto", vakValue: "A" },
      { text: "Haciéndolo paso a paso con retroalimentación inmediata", vakValue: "K" },
    ],
  },
  {
    statement:
      "Al enfrentarte a un examen, ¿qué método de estudio te da mejores resultados?",
    contentType: "text",
    vakStyle: "Kinesthetic",
    options: [
      { text: "Repasar resúmenes visuales y diagramas", vakValue: "V" },
      { text: "Resolver ejercicios y problemas de práctica", vakValue: "K" },
      { text: "Leer el material en voz alta", vakValue: "A" },
      { text: "Simular situaciones prácticas del examen", vakValue: "K" },
    ],
  },
  {
    statement:
      "Cuando aprendes a usar una nueva aplicación o tecnología, ¿qué haces?",
    contentType: "text",
    vakStyle: "Kinesthetic",
    options: [
      { text: "Ves un tutorial en video con explicación en audio", vakValue: "A" },
      { text: "La exploras directamente por tu cuenta", vakValue: "K" },
      { text: "Lees el manual o guía de usuario", vakValue: "V" },
      { text: "Pruebas todas las funciones para ver qué hace cada una", vakValue: "K" },
    ],
  },
  {
    statement:
      "¿En qué tipo de ambiente estudias mejor?",
    contentType: "text",
    vakStyle: "Kinesthetic",
    options: [
      { text: "En un lugar donde puedas moverte y cambiar de postura", vakValue: "K" },
      { text: "Con música de fondo o ruido ambiental suave", vakValue: "A" },
      { text: "En un espacio ordenado y visualmente despejado", vakValue: "V" },
      { text: "En cualquier lugar donde puedas manipular objetos o tomar notas activas", vakValue: "K" },
    ],
  },
  {
    statement:
      "En tu tiempo libre, ¿qué actividad disfrutas más?",
    contentType: "text",
    vakStyle: "Kinesthetic",
    options: [
      { text: "Escuchar música o podcasts interesantes", vakValue: "A" },
      { text: "Realizar actividades físicas o manuales", vakValue: "K" },
      { text: "Ver películas, series o contenido visual", vakValue: "V" },
      { text: "Construir o crear cosas con tus manos", vakValue: "K" },
    ],
  },
];
