import { LambdaClassifierAdapter } from "../../domain/adapters/lambda-classifier.adapter.js";
import {
  LambdaClassifierInput,
  LambdaClassifierOutput,
} from "../../domain/interfaces/result/index.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";

interface LambdaRawResponse {
  estilo_predominante: string;
  estilo_secundario: string;
  confianza: Record<string, number>;
  confianza_predominante: number;
  tipo_perfil: string;
  es_perfil_mixto: boolean;
  clasificador_tipo: string;
}

const STYLE_MAP: Record<string, string> = {
  Visual: "Visual",
  Auditivo: "Auditory",
  Kinestesico: "Kinesthetic",
};

const PROFILE_TYPE_MAP: Record<string, string> = {
  claro: "clear",
  tendencia: "tendency",
  mixto: "mixed",
};

export class LambdaClassifierAdapterImpl implements LambdaClassifierAdapter {
  async classify(input: LambdaClassifierInput): Promise<LambdaClassifierOutput> {
    if (!envs.LAMBDA_URL) {
      throw CustomError.serviceUnavailable("Lambda URL not configured");
    }

    let response: Response;
    try {
      response = await fetch(envs.LAMBDA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: input.features }),
      });
    } catch {
      throw CustomError.serviceUnavailable("Lambda request failed");
    }

    if (!response.ok) {
      throw CustomError.badGateway(`Lambda returned status ${response.status}`);
    }

    const raw: LambdaRawResponse = await response.json();

    return {
      predominantStyle: STYLE_MAP[raw.estilo_predominante] ?? raw.estilo_predominante,
      secondaryStyle: STYLE_MAP[raw.estilo_secundario] ?? raw.estilo_secundario,
      visualProbability: raw.confianza["Visual"] ?? 0,
      auditoryProbability: raw.confianza["Auditivo"] ?? 0,
      kinestheticProbability: raw.confianza["Kinestesico"] ?? 0,
      predominantConfidence: raw.confianza_predominante,
      profileType: PROFILE_TYPE_MAP[raw.tipo_perfil] ?? raw.tipo_perfil,
      isMixedProfile: raw.es_perfil_mixto,
      classifierType: raw.clasificador_tipo ?? "xgboost",
    };
  }
}
