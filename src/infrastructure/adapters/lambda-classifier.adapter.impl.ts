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
  async classify(input: LambdaClassifierInput): Promise<LambdaClassifierOutput> {
    if (!envs.LAMBDA_URL) {
      throw CustomError.serviceUnavailable("Lambda URL not configured");
    }

    const response = await fetchWithTimeout(envs.LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features: input.features }),
      timeoutMs: envs.LAMBDA_TIMEOUT_MS,
      serviceName: SERVICE_NAME,
    });

    if (!response.ok) throw upstreamStatusError(response, SERVICE_NAME);

    const raw = await readJson<any>(response, SERVICE_NAME);
    return this.toOutput(raw);
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
