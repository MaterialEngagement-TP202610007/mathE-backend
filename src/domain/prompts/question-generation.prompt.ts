const TOPICS = [
  "un experimento de ciencias",
  "una tarea de historia del Perú",
  "un trabajo grupal de comunicación",
  "una exposición de matemáticas",
  "un proyecto de arte",
  "una clase de educación física",
  "una feria escolar de tecnología",
  "un concurso de geografía",
  "una obra de teatro del colegio",
  "un problema de lógica en computación",
  "una visita de estudios a un museo",
  "preparar un discurso para el día de la bandera",
  "un debate sobre medio ambiente",
  "aprender una canción en clase de música",
  "diseñar un volante para un evento escolar",
];

const VAK_DISTRIBUTION: Record<string, string> = {
  Visual: "2 Visual (V), 1 Auditiva (A), 1 Kinestésica (K)",
  Auditory: "2 Auditivas (A), 1 Visual (V), 1 Kinestésica (K)",
  Kinesthetic: "2 Kinestésicas (K), 1 Visual (V), 1 Auditiva (A)",
};

export function buildQuestionGenerationPrompt(
  vakStyle: string,
  recentStatements: string[] = [],
): string {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const seed = Math.floor(Math.random() * 9999);
  const distribution = VAK_DISTRIBUTION[vakStyle] ?? "2 V, 1 A, 1 K";

  const avoidBlock =
    recentStatements.length > 0
      ? `\nEvita generar una situación similar a cualquiera de estas (ya existen en el banco):\n${recentStatements.map((s) => `- "${s}"`).join("\n")}\n`
      : "";

  return `Eres un experto en estilos de aprendizaje VAK, especializado en educación para niños y adolescentes de primaria y secundaria de Perú.

Tu tarea es generar UNA situación hipotética COMPLETAMENTE NUEVA Y ÚNICA sobre: "${topic}" (semilla de variación: ${seed}). La situación usa frases como "imagina que...", "si tuvieras que...", "supón que..." y el alumno debe elegir cómo actuaría. Responde siempre en español castellano peruano.
${avoidBlock}
Estilo predominante: ${vakStyle}.
Distribución obligatoria: ${distribution}.

Reglas:
- La situación debe ser DISTINTA a cualquier pregunta típica sobre estilos de aprendizaje; usa el tema indicado como contexto concreto.
- Las 4 opciones deben sonar igual de válidas, ninguna debe parecer "la más correcta".
- Redacta las opciones en primera persona ("me quedaría más claro si...", "lo entendería mejor...").
- Evita palabras que delaten el estilo: "ver", "escuchar", "tocar", "leer", "dibujar".
- Lenguaje cercano y simple, como hablaría un alumno de colegio peruano.
- No menciones los estilos VAK en ninguna parte del texto.

Responde ÚNICAMENTE con este JSON sin texto adicional:
{"statement":"...","options":[{"text":"...","vak_value":"V|A|K"}]}`;
}
