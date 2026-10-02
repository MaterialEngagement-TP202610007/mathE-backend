import { ItemValidatorAdapter } from "../../domain/adapters/item-validator.adapter.js";
import {
  ItemToValidate,
  ItemValidationBatch,
  ItemValidationResult,
  ItemViolation,
  ItemViolationSeverity,
  ItemValidatorCatalog,
} from "../../domain/interfaces/item-validation/index.js";
import { VakValue } from "../../domain/constants/vak.constant.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";
import {
  fetchWithTimeout,
  readJson,
  upstreamStatusError,
} from "../http/fetch-with-timeout.js";

const SERVICE_NAME = "MVI";

/** Delays before each retry of a throttled call (429 / 503). */
const THROTTLE_RETRY_DELAYS_MS = [500, 1000];
const MAX_RETRY_JITTER_MS = 250;
const THROTTLE_STATUSES = new Set([429, 503]);

const CATALOG_TTL_MS = 60 * 60 * 1000;

export interface MviItemValidatorAdapterOptions {
  sleep?: (ms: number) => Promise<void>;
  /** Returns a number in [0, 1); used to spread concurrent retries. */
  random?: () => number;
  /** Clock used for the catalog cache TTL. */
  now?: () => number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const STYLE_TO_VALUE: Record<string, VakValue> = {
  Visual: "V",
  Auditory: "A",
  Kinesthetic: "K",
};

const SEVERITY_MAP: Record<string, ItemViolationSeverity> = {
  bloqueante: "blocking",
  advertencia: "warning",
};

/** Accepted spellings (lowercased) of each dimension key in `marcadores`. */
const MARKER_KEYS: Record<VakValue, string[]> = {
  V: ["v", "visual"],
  A: ["a", "auditivo", "auditory"],
  K: ["k", "kinestesico", "kinestésico", "kinesthetic"],
};

/** Numeric fields of a `niveles[]` entry that may hold the statement word limit. */
const LEVEL_MAX_WORDS_FIELDS = [
  "maxPalabras",
  "maximoPalabras",
  "maxPalabrasEnunciado",
];

const STATEMENT_LENGTH_RULE_ID = "longitud-enunciado";

function invalidResponse(detail: string): CustomError {
  return CustomError.badGateway(`MVI returned an invalid response: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Collects every string nested in arrays/objects, in order, without duplicates. */
function collectStrings(value: unknown, into: Set<string>): void {
  if (typeof value === "string") {
    if (value.trim()) into.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, into));
  } else if (isRecord(value)) {
    Object.values(value).forEach((entry) => collectStrings(entry, into));
  }
}

function parseMarkers(raw: unknown): Record<VakValue, string[]> {
  const markers: Record<VakValue, string[]> = { V: [], A: [], K: [] };
  if (!isRecord(raw)) return markers;

  for (const dimension of Object.keys(markers) as VakValue[]) {
    const found = new Set<string>();
    for (const [key, value] of Object.entries(raw)) {
      if (MARKER_KEYS[dimension].includes(key.toLowerCase())) {
        collectStrings(value, found);
      }
    }
    markers[dimension] = [...found];
  }
  return markers;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseMaxWords(raw: any, level: number): number | null {
  if (Array.isArray(raw.niveles)) {
    const entry = raw.niveles.find(
      (n: unknown) =>
        isRecord(n) && (String(n.nivel) === String(level) || String(n.id) === String(level)),
    );
    if (isRecord(entry)) {
      for (const field of LEVEL_MAX_WORDS_FIELDS) {
        const value = finiteNumber(entry[field]);
        if (value !== null) return value;
      }
    }
  }

  if (Array.isArray(raw.reglas)) {
    const rule = raw.reglas.find(
      (r: unknown) => isRecord(r) && r.id === STATEMENT_LENGTH_RULE_ID,
    );
    if (isRecord(rule)) return finiteNumber(rule.umbral);
  }
  return null;
}

export class MviItemValidatorAdapterImpl implements ItemValidatorAdapter {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;
  private cachedCatalog: { catalog: ItemValidatorCatalog; expiresAt: number } | null = null;

  constructor({
    sleep = defaultSleep,
    random = Math.random,
    now = Date.now,
  }: MviItemValidatorAdapterOptions = {}) {
    this.sleep = sleep;
    this.random = random;
    this.now = now;
  }

  async validate(items: ItemToValidate[], bank: string[]): Promise<ItemValidationBatch> {
    if (!envs.MVI_URL) {
      throw CustomError.serviceUnavailable("MVI URL not configured");
    }

    const body = JSON.stringify({
      items: items.map((item) => this.toRequestItem(item)),
      banco: bank,
    });
    let response = await this.post(body);

    // Throttled calls are rejected instantly, so a short retry usually lands
    // on a freed slot. Timeouts and other errors are not retried.
    for (const delayMs of THROTTLE_RETRY_DELAYS_MS) {
      if (!THROTTLE_STATUSES.has(response.status)) break;
      await this.sleep(delayMs + Math.floor(this.random() * MAX_RETRY_JITTER_MS));
      response = await this.post(body);
    }

    if (response.status === 401) {
      // Never log the token itself.
      console.error("MVI rejected the token (401): check MVI_TOKEN");
      throw CustomError.serviceUnavailable("MVI authentication failed");
    }
    if (response.status === 400) {
      throw CustomError.badGateway(
        `MVI rejected the request (400): ${await this.readErrorDetail(response)}`,
      );
    }
    if (!response.ok) throw upstreamStatusError(response, SERVICE_NAME);

    const raw = await readJson<any>(response, SERVICE_NAME);
    return this.toBatch(raw, items.length);
  }

  async wakeUp(): Promise<boolean> {
    if (!envs.MVI_URL) return false;
    try {
      const response = await fetchWithTimeout(`${envs.MVI_URL}/salud`, {
        method: "GET",
        timeoutMs: envs.MVI_WAKEUP_TIMEOUT_MS,
        serviceName: SERVICE_NAME,
      });
      if (!response.ok) return false;
      const raw = await readJson<any>(response, SERVICE_NAME);
      return raw?.estado === "ok";
    } catch {
      return false;
    }
  }

  async getCatalog(): Promise<ItemValidatorCatalog | null> {
    if (!envs.MVI_URL) return null;
    if (this.cachedCatalog && this.cachedCatalog.expiresAt > this.now()) {
      return this.cachedCatalog.catalog;
    }

    try {
      const response = await fetchWithTimeout(`${envs.MVI_URL}/reglas`, {
        method: "GET",
        headers: { Authorization: `Bearer ${envs.MVI_TOKEN}` },
        timeoutMs: envs.MVI_TIMEOUT_MS,
        serviceName: SERVICE_NAME,
      });
      if (!response.ok) throw upstreamStatusError(response, SERVICE_NAME);

      const raw = await readJson<any>(response, SERVICE_NAME);
      if (!isRecord(raw) || typeof raw.version !== "string") {
        throw invalidResponse("catalog version missing");
      }

      const catalog: ItemValidatorCatalog = {
        version: raw.version,
        maxWords: parseMaxWords(raw, envs.MVI_NIVEL),
        markers: parseMarkers(raw.marcadores),
      };
      this.cachedCatalog = { catalog, expiresAt: this.now() + CATALOG_TTL_MS };
      return catalog;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      console.warn(`MVI catalog unavailable: ${reason}`);
      return null;
    }
  }

  private toRequestItem(item: ItemToValidate) {
    return {
      ...(item.id !== undefined && { id: item.id }),
      enunciado: item.statement,
      dimensionDeclarada: STYLE_TO_VALUE[item.vakStyle],
      nivel: envs.MVI_NIVEL,
      opciones: item.options.map((option) => ({
        texto: option.text,
        dimension: option.vakValue,
      })),
    };
  }

  private post(body: string): Promise<Response> {
    return fetchWithTimeout(`${envs.MVI_URL}/validar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${envs.MVI_TOKEN}`,
      },
      body,
      timeoutMs: envs.MVI_TIMEOUT_MS,
      serviceName: SERVICE_NAME,
    });
  }

  private async readErrorDetail(response: Response): Promise<string> {
    try {
      const raw = await response.json();
      const { codigo, mensaje } = raw?.error ?? {};
      return [codigo, mensaje].filter((p) => typeof p === "string").join(": ") || "no detail";
    } catch {
      return "no detail";
    }
  }

  /** Validates the raw payload so a malformed response never reads as approval. */
  private toBatch(raw: any, expectedCount: number): ItemValidationBatch {
    if (!isRecord(raw)) throw invalidResponse("empty body");
    if (!Array.isArray(raw.resultados) || raw.resultados.length !== expectedCount) {
      throw invalidResponse("resultados must match the submitted items");
    }
    if (typeof raw.versionCatalogo !== "string") {
      throw invalidResponse("versionCatalogo must be a string");
    }

    return {
      results: raw.resultados.map((entry: unknown) => this.toResult(entry)),
      catalogVersion: raw.versionCatalogo,
    };
  }

  private toResult(entry: unknown): ItemValidationResult {
    if (!isRecord(entry)) throw invalidResponse("result must be an object");
    if (typeof entry.aprobado !== "boolean") {
      throw invalidResponse("aprobado must be a boolean");
    }
    if (!Array.isArray(entry.violaciones)) {
      throw invalidResponse("violaciones must be an array");
    }

    return {
      ...(typeof entry.id === "string" && { id: entry.id }),
      approved: entry.aprobado,
      violations: entry.violaciones.map((v: unknown) => this.toViolation(v)),
    };
  }

  private toViolation(raw: unknown): ItemViolation {
    if (!isRecord(raw)) throw invalidResponse("violation must be an object");
    if (typeof raw.reglaId !== "string") throw invalidResponse("reglaId must be a string");
    if (typeof raw.mensaje !== "string") throw invalidResponse("mensaje must be a string");
    const severity =
      typeof raw.severidad === "string" ? SEVERITY_MAP[raw.severidad] : undefined;
    if (!severity) throw invalidResponse("unknown severidad");

    return {
      ruleId: raw.reglaId,
      message: raw.mensaje,
      measuredValue: raw.valorMedido,
      threshold: raw.umbral,
      severity,
    };
  }
}
