import { LambdaClassifierAdapter } from "../../domain/adapters/lambda-classifier.adapter.js";
import {
  LambdaClassifierInput,
  LambdaClassifierOutput,
} from "../../domain/interfaces/result/index.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";
import {
  fetchWithTimeout,
  readJson,
  upstreamStatusError,
} from "../http/fetch-with-timeout.js";

const SERVICE_NAME = "Lambda";

/** Delays before each retry of a throttled call (API Gateway 503 / Lambda 429). */
const THROTTLE_RETRY_DELAYS_MS = [500, 1000];
const MAX_RETRY_JITTER_MS = 250;
const THROTTLE_STATUSES = new Set([429, 503]);

export interface LambdaClassifierAdapterOptions {
  sleep?: (ms: number) => Promise<void>;
  /** Returns a number in [0, 1); used to spread concurrent retries. */
  random?: () => number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type DomainStyle = "Visual" | "Auditory" | "Kinesthetic";

const STYLE_MAP: Record<string, DomainStyle> = {
  Visual: "Visual",
  Auditivo: "Auditory",
  Kinestesico: "Kinesthetic",
  "Kinestésico": "Kinesthetic",
};

const PROFILE_TYPE_MAP: Record<string, string> = {
  claro: "clear",
  tendencia: "tendency",
  mixto: "mixed",
};

function invalidResponse(detail: string): CustomError {
  return CustomError.badGateway(`Lambda returned an invalid response: ${detail}`);
}

function mapStyle(value: unknown, field: string): DomainStyle {
  const style = typeof value === "string" ? STYLE_MAP[value] : undefined;
  if (!style) throw invalidResponse(`unknown ${field}`);
  return style;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalidResponse(`${field} must be a number`);
  }
  return value;
}

export class LambdaClassifierAdapterImpl implements LambdaClassifierAdapter {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor({ sleep = defaultSleep, random = Math.random }: LambdaClassifierAdapterOptions = {}) {
    this.sleep = sleep;
    this.random = random;
  }

  async classify(input: LambdaClassifierInput): Promise<LambdaClassifierOutput> {
    if (!envs.LAMBDA_URL) {
      throw CustomError.serviceUnavailable("Lambda URL not configured");
    }

    const body = JSON.stringify({ features: input.features });
    let response = await this.post(body);

    // Throttled calls are rejected instantly when the account concurrency limit
    // is reached, so a short retry usually lands on a freed execution slot.
    // Timeouts and other errors are not retried: they fall back right away.
    for (const delayMs of THROTTLE_RETRY_DELAYS_MS) {
      if (!THROTTLE_STATUSES.has(response.status)) break;
      await this.sleep(delayMs + Math.floor(this.random() * MAX_RETRY_JITTER_MS));
      response = await this.post(body);
    }

    if (!response.ok) throw upstreamStatusError(response, SERVICE_NAME);

    const raw = await readJson<any>(response, SERVICE_NAME);
    return this.toOutput(raw);
  }

  private post(body: string): Promise<Response> {
    return fetchWithTimeout(envs.LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      timeoutMs: envs.LAMBDA_TIMEOUT_MS,
      serviceName: SERVICE_NAME,
    });
  }

  /** Validates the raw payload so any malformed response triggers the fallback. */
  private toOutput(raw: any): LambdaClassifierOutput {
    if (!raw || typeof raw !== "object") throw invalidResponse("empty body");

    const predominantStyle = mapStyle(raw.estilo_predominante, "estilo_predominante");
    const secondaryStyle = mapStyle(raw.estilo_secundario, "estilo_secundario");

    const confidence = raw.confianza;
    if (!confidence || typeof confidence !== "object") {
      throw invalidResponse("missing confianza");
    }

    // Probabilities are keyed by the Spanish label (accented or not).
    const probabilities: Record<DomainStyle, number | undefined> = {
      Visual: undefined,
      Auditory: undefined,
      Kinesthetic: undefined,
    };
    for (const [label, value] of Object.entries(confidence)) {
      const style = STYLE_MAP[label];
      if (style) probabilities[style] = requireNumber(value, `confianza.${label}`);
    }

    const profileType =
      typeof raw.tipo_perfil === "string"
        ? PROFILE_TYPE_MAP[raw.tipo_perfil]
        : undefined;
    if (!profileType) throw invalidResponse("unknown tipo_perfil");

    if (typeof raw.es_perfil_mixto !== "boolean") {
      throw invalidResponse("es_perfil_mixto must be a boolean");
    }

    return {
      predominantStyle,
      secondaryStyle,
      visualProbability: requireNumber(probabilities.Visual, "confianza.Visual"),
      auditoryProbability: requireNumber(probabilities.Auditory, "confianza.Auditivo"),
      kinestheticProbability: requireNumber(
        probabilities.Kinesthetic,
        "confianza.Kinestesico",
      ),
      predominantConfidence: requireNumber(
        raw.confianza_predominante,
        "confianza_predominante",
      ),
      profileType,
      isMixedProfile: raw.es_perfil_mixto,
      classifierType:
        typeof raw.clasificador_tipo === "string" && raw.clasificador_tipo
          ? raw.clasificador_tipo
          : "xgboost",
    };
  }
}
