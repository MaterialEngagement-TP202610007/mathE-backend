import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { AnswerRepository } from "../../repositories/answer.repository.js";
import { MLModelRepository } from "../../repositories/ml-model.repository.js";
import { ResultRepository } from "../../repositories/result.repository.js";
import { LambdaClassifierAdapter } from "../../adapters/lambda-classifier.adapter.js";
import { VakFeedbackAdapter } from "../../adapters/vak-feedback.adapter.js";
import { CompleteQuestionnaireDto } from "../../dtos/questionnaire/complete-questionnaire.dto.js";
import { CustomError } from "../../error/custom-error.js";
import {
  AnswerWithVakOption,
} from "../../interfaces/answer/index.js";
import {
  CompleteQuestionnaireResult,
  LambdaClassifierOutput,
  VakFeatures,
} from "../../interfaces/result/index.js";

export class CompleteQuestionnaireUseCase {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
    private readonly answerRepository: AnswerRepository,
    private readonly mlModelRepository: MLModelRepository,
    private readonly resultRepository: ResultRepository,
    private readonly lambdaClassifierAdapter: LambdaClassifierAdapter,
    private readonly vakFeedbackAdapter: VakFeedbackAdapter,
  ) {}

  async execute(
    id: number,
    studentId: number,
    dto: CompleteQuestionnaireDto,
  ): Promise<CompleteQuestionnaireResult> {
    const questionnaire = await this.questionnaireRepository.findById(id);
    if (!questionnaire)
      throw CustomError.notFound(`Questionnaire ${id} not found`);
    if (questionnaire.studentId !== studentId)
      throw CustomError.forbidden("Questionnaire does not belong to you");
    if (questionnaire.status !== "in_progress")
      throw CustomError.badRequest(
        `Questionnaire is already ${questionnaire.status}`,
      );

    const answers = await this.answerRepository.findAllWithOptions(id);
    if (answers.length !== 10)
      throw CustomError.badRequest(
        `Expected 10 answers, found ${answers.length}`,
      );

    await this.questionnaireRepository.complete(id, {
      totalTimeSeconds: dto.totalTimeSeconds,
      completionPercentage: dto.completionPercentage,
    });

    const features = this.calculateFeatures(answers, dto.totalTimeSeconds);
    const simpleStyle = this.getSimpleStyle(features);
    const simpleProbs = {
      visualProbability: features.visualScore / 10,
      auditoryProbability: features.auditoryScore / 10,
      kinestheticProbability: features.kinestheticScore / 10,
    };

    const activeModel = await this.mlModelRepository.findActive();
    let lambdaResult: LambdaClassifierOutput | null = null;
    let classifierType = "simple_score";

    if (activeModel) {
      try {
        lambdaResult = await this.lambdaClassifierAdapter.classify({ features });
        classifierType = "xgboost";
      } catch {
        // Lambda failed — fall back to simple_score
      }
    }

    const predominantStyle = lambdaResult?.predominantStyle ?? simpleStyle;
    const visualProbability =
      lambdaResult?.visualProbability ?? simpleProbs.visualProbability;
    const auditoryProbability =
      lambdaResult?.auditoryProbability ?? simpleProbs.auditoryProbability;
    const kinestheticProbability =
      lambdaResult?.kinestheticProbability ?? simpleProbs.kinestheticProbability;
    const modelVersion = lambdaResult?.modelVersion ?? null;
    const isMixedProfile =
      visualProbability < 0.45 &&
      auditoryProbability < 0.45 &&
      kinestheticProbability < 0.45;

    let aiFeedback: string;
    let feedbackSource: string;
    try {
      aiFeedback = await this.vakFeedbackAdapter.generateFeedback(
        predominantStyle,
        visualProbability,
        auditoryProbability,
        kinestheticProbability,
      );
      feedbackSource = "gemini";
    } catch {
      aiFeedback = this.getPredefinedFeedback(predominantStyle);
      feedbackSource = "predefined";
    }

    const result = await this.resultRepository.saveWithDatasetAndNotification({
      questionnaireId: id,
      studentId,
      mlModelId: classifierType === "xgboost" ? activeModel!.id : null,
      predominantStyle,
      visualProbability,
      auditoryProbability,
      kinestheticProbability,
      isMixedProfile,
      classifierType,
      modelVersion,
      aiFeedback,
      feedbackSource,
      visualScore: features.visualScore,
      auditoryScore: features.auditoryScore,
      kinestheticScore: features.kinestheticScore,
      avgQuestionTime: features.avgQuestionTime,
      totalTime: dto.totalTimeSeconds,
      totalChanges: features.totalChanges,
      totalClicks: features.totalClicks,
      engagementLevel: features.engagementLevel,
      responseConsistency: features.responseConsistency,
      completionPercentage: dto.completionPercentage,
      vakLabel: simpleStyle,
    });

    return {
      resultId: result.id,
      predominantStyle,
      visualProbability,
      auditoryProbability,
      kinestheticProbability,
      isMixedProfile,
      classifierType,
      aiFeedback,
      feedbackSource,
    };
  }

  private calculateFeatures(
    answers: AnswerWithVakOption[],
    totalTimeSeconds: number | null,
  ): VakFeatures {
    let visualScore = 0;
    let auditoryScore = 0;
    let kinestheticScore = 0;
    let totalQuestionTime = 0;
    let totalChanges = 0;
    let totalClicks = 0;

    for (const a of answers) {
      if (a.vakValue === "V") visualScore++;
      else if (a.vakValue === "A") auditoryScore++;
      else if (a.vakValue === "K") kinestheticScore++;

      totalQuestionTime += a.questionTimeSeconds ?? 0;
      totalChanges += a.numberOfChanges ?? 0;
      totalClicks += a.numberOfClicks ?? 0;
    }

    const avgQuestionTime = totalQuestionTime / 10;
    const engagementLevel =
      totalTimeSeconds && totalTimeSeconds > 0
        ? totalQuestionTime / totalTimeSeconds
        : 0;
    const maxScore = Math.max(visualScore, auditoryScore, kinestheticScore);
    const responseConsistency = maxScore / 10;

    return {
      visualScore,
      auditoryScore,
      kinestheticScore,
      avgQuestionTime,
      totalChanges,
      totalClicks,
      engagementLevel,
      responseConsistency,
    };
  }

  private getSimpleStyle(features: VakFeatures): string {
    const { visualScore, auditoryScore, kinestheticScore } = features;
    if (visualScore >= auditoryScore && visualScore >= kinestheticScore)
      return "Visual";
    if (auditoryScore >= kinestheticScore) return "Auditory";
    return "Kinesthetic";
  }

  private getPredefinedFeedback(style: string): string {
    const map: Record<string, string> = {
      Visual:
        "Tu estilo de aprendizaje predominante es Visual. Aprendes mejor cuando puedes ver la información: diagramas, mapas, videos e imágenes te ayudan a entender y recordar mejor. Intenta hacer esquemas y usar colores al estudiar.",
      Auditory:
        "Tu estilo de aprendizaje predominante es Auditivo. Aprendes mejor escuchando y hablando: las explicaciones en voz alta, los debates y las canciones te ayudan a fijar los conocimientos. Intenta leer en voz alta y escuchar grabaciones de tus clases.",
      Kinesthetic:
        "Tu estilo de aprendizaje predominante es Kinestésico. Aprendes mejor haciendo y experimentando: los trabajos prácticos, los experimentos y los juegos de rol te permiten comprender mejor los temas. Intenta moverte mientras estudias y busca actividades manuales.",
    };
    return (
      map[style] ??
      "Tus resultados muestran un perfil mixto de aprendizaje. Combinas varios estilos según la situación, lo que es una fortaleza. Explora diferentes formas de estudiar para aprovechar al máximo cada estilo."
    );
  }
}
