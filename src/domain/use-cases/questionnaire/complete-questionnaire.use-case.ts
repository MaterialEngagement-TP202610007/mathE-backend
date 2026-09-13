import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { MLDatasetRepository } from "../../repositories/ml-dataset.repository.js";
import { MLModelRepository } from "../../repositories/ml-model.repository.js";
import { ResultRepository } from "../../repositories/result.repository.js";
import { LambdaClassifierAdapter } from "../../adapters/lambda-classifier.adapter.js";
import { VakFeedbackAdapter } from "../../adapters/vak-feedback.adapter.js";
import { CompleteQuestionnaireDto } from "../../dtos/questionnaire/complete-questionnaire.dto.js";
import { CustomError } from "../../error/custom-error.js";
import { ResultEntity } from "../../entities/result.entity.js";
import { assertOwnsQuestionnaire } from "../../policies/questionnaire-access.policy.js";
import {
  CompleteQuestionnaireResult,
  LambdaClassifierOutput,
} from "../../interfaces/result/index.js";
import { CompleteWithAnswersAndDatasetResult } from "../../interfaces/questionnaire/index.js";

type CompletionFeatures = Omit<CompleteWithAnswersAndDatasetResult, "vakLabel">;

export class CompleteQuestionnaireUseCase {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
    private readonly mlDatasetRepository: MLDatasetRepository,
    private readonly mlModelRepository: MLModelRepository,
    private readonly resultRepository: ResultRepository,
    private readonly lambdaClassifierAdapter: LambdaClassifierAdapter,
    private readonly vakFeedbackAdapter: VakFeedbackAdapter,
  ) {}

  /**
   * Idempotent completion:
   * - in_progress → persist answers + dataset, classify, save result.
   * - completed with a result → return that result (safe client retry).
   * - completed without a result (a previous attempt failed after committing
   *   the answers) → resume classification from the persisted dataset.
   */
  async execute(
    id: number,
    studentId: number,
    dto: CompleteQuestionnaireDto,
  ): Promise<CompleteQuestionnaireResult> {
    const questionnaire = await this.questionnaireRepository.findById(id);
    if (!questionnaire)
      throw CustomError.notFound(`Questionnaire ${id} not found`);
    assertOwnsQuestionnaire(questionnaire, studentId);

    if (questionnaire.status === "completed") {
      return this.resumeCompleted(id, studentId);
    }

    if (questionnaire.status !== "in_progress")
      throw CustomError.badRequest(
        `Questionnaire is already ${questionnaire.status}`,
      );

    await this.validateAnswers(id, dto);

    // Atomic transaction: save answers, compute features, create MLDataset, complete questionnaire
    const features = await this.questionnaireRepository.completeWithAnswersAndDataset({
      questionnaireId: id,
      studentId,
      completionPercentage: dto.completionPercentage,
      answers: dto.answers.map((a, idx) => ({
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        navigationSequence: idx + 1,
        questionTimeSeconds: a.questionTimeSeconds,
        numberOfChanges: a.numberOfChanges,
        timesReviewed: a.timesReviewed,
      })),
    });

    return this.classifyAndSave(id, studentId, features);
  }

  private async resumeCompleted(
    id: number,
    studentId: number,
  ): Promise<CompleteQuestionnaireResult> {
    const existing = await this.resultRepository.findByQuestionnaire(id);
    if (existing) return this.toResponse(existing);

    const dataset = await this.mlDatasetRepository.findByQuestionnaire(id);
    if (!dataset)
      throw CustomError.conflict(
        `Questionnaire ${id} is completed but its answers were not recorded`,
      );

    return this.classifyAndSave(id, studentId, {
      visualScore: dataset.visualScore ?? 0,
      auditoryScore: dataset.auditoryScore ?? 0,
      kinestheticScore: dataset.kinestheticScore ?? 0,
      responseConsistency: dataset.responseConsistency ?? 0,
      avgQuestionTime: dataset.avgQuestionTime ?? 0,
      totalChanges: dataset.totalChanges ?? 0,
      totalReviews: dataset.totalReviews ?? 0,
    });
  }

  private async validateAnswers(
    id: number,
    dto: CompleteQuestionnaireDto,
  ): Promise<void> {
    const questionOptions =
      await this.questionnaireRepository.findQuestionOptions(id);
    const optionsByQuestion = new Map(
      questionOptions.map((q) => [q.questionId, new Set(q.optionIds)]),
    );

    const answered = new Set<number>();
    for (const answer of dto.answers) {
      const validOptions = optionsByQuestion.get(answer.questionId);
      if (!validOptions)
        throw CustomError.badRequest(
          `Question ${answer.questionId} does not belong to questionnaire ${id}`,
        );
      if (answered.has(answer.questionId))
        throw CustomError.badRequest(
          `Question ${answer.questionId} was answered more than once`,
        );
      answered.add(answer.questionId);

      if (
        answer.selectedOptionId !== null &&
        !validOptions.has(answer.selectedOptionId)
      )
        throw CustomError.badRequest(
          `Option ${answer.selectedOptionId} does not belong to question ${answer.questionId}`,
        );
    }
  }

  private async classifyAndSave(
    id: number,
    studentId: number,
    features: CompletionFeatures,
  ): Promise<CompleteQuestionnaireResult> {
    // Try Lambda classification, fall back to simple_score
    const activeModel = await this.mlModelRepository.findActive();
    let lambdaResult: LambdaClassifierOutput | null = null;

    try {
      lambdaResult = await this.lambdaClassifierAdapter.classify({
        features: {
          visual_score: features.visualScore,
          auditory_score: features.auditoryScore,
          kinesthetic_score: features.kinestheticScore,
          response_consistency: features.responseConsistency,
          avg_response_time: features.avgQuestionTime,
          total_changes: features.totalChanges,
          total_backtracks: features.totalReviews,
        },
      });
    } catch (err) {
      console.error(
        "[complete] Lambda classification failed, using simple_score:",
        errorMessage(err),
      );
    }

    const classification = lambdaResult ?? this.buildSimpleScoreResult(features);
    const {
      predominantStyle,
      visualProbability,
      auditoryProbability,
      kinestheticProbability,
      classifierType,
    } = classification;

    const mlModelId = classifierType === "xgboost" && activeModel ? activeModel.id : null;
    const modelVersion = classifierType === "xgboost" && activeModel ? activeModel.version : null;

    // Generate AI feedback (Gemini), fall back to predefined on failure
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
    } catch (err) {
      console.error(
        "[complete] Gemini feedback failed, using predefined feedback:",
        errorMessage(err),
      );
      aiFeedback = this.getPredefinedFeedback(predominantStyle);
      feedbackSource = "predefined";
    }

    let result: ResultEntity;
    try {
      result = await this.resultRepository.saveWithNotification({
        questionnaireId: id,
        studentId,
        mlModelId,
        ...classification,
        modelVersion,
        aiFeedback,
        feedbackSource,
      });
    } catch (err) {
      // A concurrent retry may have saved the result first (unique questionnaireId).
      const existing = await this.resultRepository.findByQuestionnaire(id);
      if (existing) return this.toResponse(existing);
      throw err;
    }

    return {
      resultId: result.id,
      ...classification,
      aiFeedback,
      feedbackSource,
    };
  }

  private toResponse(result: ResultEntity): CompleteQuestionnaireResult {
    return {
      resultId: result.id,
      predominantStyle: result.predominantStyle ?? "",
      secondaryStyle: result.secondaryStyle,
      visualProbability: result.visualProbability ?? 0,
      auditoryProbability: result.auditoryProbability ?? 0,
      kinestheticProbability: result.kinestheticProbability ?? 0,
      predominantConfidence: result.predominantConfidence ?? 0,
      profileType: result.profileType,
      isMixedProfile: result.isMixedProfile,
      classifierType: result.classifierType ?? "",
      aiFeedback: result.aiFeedback ?? "",
      feedbackSource: result.feedbackSource ?? "",
    };
  }

  private buildSimpleScoreResult(
    tx: CompletionFeatures,
  ): LambdaClassifierOutput {
    const scores = [
      { style: "Visual", value: tx.visualScore },
      { style: "Auditory", value: tx.auditoryScore },
      { style: "Kinesthetic", value: tx.kinestheticScore },
    ].sort((a, b) => b.value - a.value);

    const total = tx.visualScore + tx.auditoryScore + tx.kinestheticScore || 1;
    const visualProbability = (tx.visualScore / total) * 100;
    const auditoryProbability = (tx.auditoryScore / total) * 100;
    const kinestheticProbability = (tx.kinestheticScore / total) * 100;
    const predominantConfidence = scores[0].value / 10 * 100;

    let profileType: string;
    if (predominantConfidence >= 70) profileType = "clear";
    else if (predominantConfidence >= 50) profileType = "tendency";
    else profileType = "mixed";

    return {
      predominantStyle: scores[0].style,
      secondaryStyle: scores[1].style,
      visualProbability,
      auditoryProbability,
      kinestheticProbability,
      predominantConfidence,
      profileType,
      isMixedProfile: profileType === "mixed",
      classifierType: "simple_score",
    };
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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
