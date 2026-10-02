import type { ItemValidatorCatalog } from "../interfaces/item-validation/index.js";
import type { GeneratedQuestion } from "../interfaces/question/index.js";

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

const DEFAULT_MAX_WORDS = 30;
const MAX_MARKERS_PER_STYLE = 20;
const MAX_FEEDBACK_MESSAGES = 8;
const JSON_OUTPUT_INSTRUCTION = `Responde ÚNICAMENTE con este JSON sin texto adicional:
{"statement":"...","options":[{"text":"...","vak_value":"V|A|K"}]}`;
const GENERIC_VERBS = ["ver", "tocar", "hacer"];

export interface QuestionPromptOptions {
  /** Blocking messages of the previous rejected attempt, to be corrected. */
  feedback?: string[];
  /** Active MVI catalog; its markers and word cap shape the prompt. */
  catalog?: ItemValidatorCatalog | null;
}

export function buildQuestionGenerationPrompt(
  vakStyle: string,
  recentStatements: string[] = [],
  options: QuestionPromptOptions = {},
): string {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const seed = Math.floor(Math.random() * 9999);
  const distribution = VAK_DISTRIBUTION[vakStyle] ?? "2 V, 1 A, 1 K";
  const catalog = options.catalog ?? null;
  const maxWords = catalog?.maxWords ?? DEFAULT_MAX_WORDS;

  const avoidBlock =
    recentStatements.length > 0
      ? `\nEvita generar una situación similar a cualquiera de estas (ya existen en el banco):\n${recentStatements.map((s) => `- "${s}"`).join("\n")}\n`
      : "";

  const feedback = [...new Set(options.feedback ?? [])].slice(0, MAX_FEEDBACK_MESSAGES);
  const feedbackBlock =
    feedback.length > 0
      ? `\nTu intento anterior fue rechazado por estas razones; corrígelas:\n${feedback.map((m) => `- ${m}`).join("\n")}\n`
      : "";

  return `Eres un experto en estilos de aprendizaje VAK, especializado en educación para estudiantes de 6to de primaria y 1ro de secundaria de Perú (11 a 12 años).

Tu tarea es generar UNA pregunta COMPLETAMENTE NUEVA Y ÚNICA sobre: "${topic}" (semilla de variación: ${seed}). El alumno debe elegir cómo actuaría o qué le ayudaría más. Responde siempre en español castellano peruano.
${avoidBlock}${feedbackBlock}
Estilo predominante: ${vakStyle}.
Distribución obligatoria: ${distribution}.

Reglas del enunciado:
- Una pregunta corta y directa, de máximo ${maxWords} palabras. Puede incluir una breve situación escolar cotidiana siempre que respete ese límite.
- Debe ser DISTINTA a cualquier pregunta típica sobre estilos de aprendizaje; usa el tema indicado como contexto concreto.

Reglas de las opciones:
${optionRules(catalog)}
- No menciones los estilos VAK en ninguna parte del texto.

${JSON_OUTPUT_INSTRUCTION}`;
}

/**
 * Asks the model to fix a rejected attempt in place: same situation and
 * options, changing only what the rejection reasons require.
 */
export function buildQuestionRevisionPrompt(
  vakStyle: string,
  previous: GeneratedQuestion,
  feedback: string[],
  options: { catalog?: ItemValidatorCatalog | null } = {},
): string {
  const catalog = options.catalog ?? null;
  const maxWords = catalog?.maxWords ?? DEFAULT_MAX_WORDS;
  const reasons = [...new Set(feedback)].slice(0, MAX_FEEDBACK_MESSAGES);
  const previousJson = JSON.stringify({
    statement: previous.statement,
    options: previous.options.map((o) => ({ text: o.text, vak_value: o.vakValue })),
  });

  return `Eres un experto en estilos de aprendizaje VAK, especializado en educación para estudiantes de 6to de primaria y 1ro de secundaria de Perú (11 a 12 años).

Tu tarea es CORREGIR una pregunta que fue rechazada por un validador, sin cambiar su idea. Responde siempre en español castellano peruano.

Estilo predominante: ${vakStyle}.

Pregunta rechazada:
${previousJson}

Razones del rechazo:
${reasons.map((m) => `- ${m}`).join("\n")}

Cómo corregirla:
- Conserva la misma situación y el mismo sentido del enunciado.
- Conserva las mismas 4 opciones, en el mismo orden y con el mismo vak_value cada una.
- Cambia SOLO lo necesario para resolver las razones del rechazo; deja igual todo lo que ya estaba bien.
${revisionVocabularyStep(catalog)}
Reglas que se siguen cumpliendo:
- Enunciado corto y directo, de máximo ${maxWords} palabras.
${optionRules(catalog)}
- No menciones los estilos VAK en ninguna parte del texto.

${JSON_OUTPUT_INSTRUCTION}`;
}

function revisionVocabularyStep(catalog: ItemValidatorCatalog | null): string {
  if ((catalog?.vocabulary ?? []).length === 0) return "";
  return "- Si una razón señala palabras fuera del vocabulario, reemplaza cada una por una palabra del vocabulario permitido o reformula esa frase usando solo palabras permitidas.\n";
}

function optionRules(catalog: ItemValidatorCatalog | null): string {
  return `- Exactamente 4 opciones que suenen igual de válidas; ninguna debe parecer "la más correcta".
- Redáctalas en primera persona.
- Longitud parecida: entre 4 y 8 palabras cada una.
- Todas deben empezar con el mismo tipo de palabra: un verbo en infinitivo.
- Sin negaciones: no uses "no", "nunca", "tampoco".
- Palabras comunes, simples y cotidianas que conozca un niño de 11 a 12 años.
${styleRules(catalog)}${vocabularyRules(catalog)}`;
}

function vocabularyRules(catalog: ItemValidatorCatalog | null): string {
  const vocabulary = catalog?.vocabulary ?? [];
  if (vocabulary.length === 0) return "";

  const functionWords = catalog?.functionWords ?? [];
  const functionLine =
    functionWords.length > 0
      ? `\n- También puedes usar estas palabras funcionales (artículos, preposiciones, conjunciones, pronombres): ${functionWords.join(", ")}`
      : "";

  return `
- VOCABULARIO: TODA palabra de contenido del enunciado Y de las opciones debe estar en esta lista de vocabulario permitido (usa las formas exactas tal como aparecen, con las mismas tildes): ${vocabulary.join(", ")}${functionLine}
- Si necesitas una palabra que no está en la lista, reformula la idea con palabras de la lista; no inventes nombres propios ni términos técnicos.`;
}

function styleRules(catalog: ItemValidatorCatalog | null): string {
  const markers = catalog ? vocabularyMarkers(catalog) : undefined;
  const hasMarkers =
    !!markers && (["V", "A", "K"] as const).some((v) => markers[v]?.length > 0);

  if (!catalog || !markers || !hasMarkers) {
    return `- Evita los verbos genéricos ${quoteList(GENERIC_VERBS)}; usa acciones concretas y observables propias de cada estilo (visual: mirar un mapa, un esquema o colores; auditivo: escuchar, explicar en voz alta o conversar; kinestésico: armar, construir o moverse).`;
  }

  const all = new Set(
    (["V", "A", "K"] as const).flatMap((v) =>
      (markers[v] ?? []).map((w) => w.toLowerCase()),
    ),
  );
  const banned = GENERIC_VERBS.filter((w) => !all.has(w));
  const perStyle = (["V", "A", "K"] as const)
    .map((v) => `  ${v}: ${(markers[v] ?? []).slice(0, MAX_MARKERS_PER_STYLE).join(", ")}`)
    .join("\n");
  const ban =
    banned.length > 0
      ? `\n- Evita los verbos genéricos ${quoteList(banned)}; usa acciones concretas y observables.`
      : "";

  const vocabNote =
    (catalog.vocabulary ?? []).length > 0
      ? "\n- Las palabras marcadoras que uses también deben pertenecer al vocabulario permitido."
      : "";

  return `- CADA opción debe incluir al menos una palabra concreta de la lista de SU propio estilo:\n${perStyle}${ban}${vocabNote}`;
}

/** Restricts each style's markers to the vocabulary; keeps the original list when none survive. */
function vocabularyMarkers(
  catalog: ItemValidatorCatalog,
): ItemValidatorCatalog["markers"] {
  const allowed = new Set((catalog.vocabulary ?? []).map((w) => w.toLowerCase()));
  if (allowed.size === 0) return catalog.markers;

  const restrict = (list: string[] = []) => {
    const kept = list.filter((w) => allowed.has(w.toLowerCase()));
    return kept.length > 0 ? kept : list;
  };
  return {
    V: restrict(catalog.markers.V),
    A: restrict(catalog.markers.A),
    K: restrict(catalog.markers.K),
  };
}

function quoteList(words: string[]): string {
  return words.map((w) => `"${w}"`).join(", ");
}
