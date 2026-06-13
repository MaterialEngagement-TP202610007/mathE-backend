import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { MLModelRepository } from "../../repositories/ml-model.repository.js";
import { ResultRepository } from "../../repositories/result.repository.js";
import { LambdaClassifierAdapter } from "../../adapters/lambda-classifier.adapter.js";
import { VakFeedbackAdapter } from "../../adapters/vak-feedback.adapter.js";
import { CompleteQuestionnaireDto } from "../../dtos/questionnaire/complete-questionnaire.dto.js";
import { CustomError } from "../../error/custom-error.js";
import {
  CompleteQuestionnaireResult,
  LambdaClassifierOutput,
} from "../../interfaces/result/index.js";
import { CompleteWithAnswersAndDatasetResult } from "../../interfaces/questionnaire/index.js";

export class CompleteQuestionnaireUseCase {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
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
    // Validate questionnaire
    const questionnaire = await this.questionnaireRepository.findById(id);
    if (!questionnaire)
      throw CustomError.notFound(`Questionnaire ${id} not found`);
    if (questionnaire.studentId !== studentId)
      throw CustomError.forbidden("Questionnaire does not belong to you");
    if (questionnaire.status !== "in_progress")
      throw CustomError.badRequest(
        `Questionnaire is already ${questionnaire.status}`,
      );

    // Atomic transaction: save answers, compute features, create MLDataset, complete questionnaire
    const txResult = await this.questionnaireRepository.completeWithAnswersAndDataset({
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

    // Try Lambda classification, fall back to simple_score
    const activeModel = await this.mlModelRepository.findActive();
    let lambdaResult: LambdaClassifierOutput | null = null;

    if (activeModel) {
      try {
        lambdaResult = await this.lambdaClassifierAdapter.classify({
          features: {
            visualScore: txResult.visualScore,
            auditoryScore: txResult.auditoryScore,
            kinestheticScore: txResult.kinestheticScore,
            responseConsistency: txResult.responseConsistency,
            avgQuestionTime: txResult.avgQuestionTime,
            totalChanges: txResult.totalChanges,
            totalReviews: txResult.totalReviews,
          },
        });
      } catch {
        // Lambda unavailable — fall back to simple_score
      }
    }

    const {
      predominantStyle,
      secondaryStyle,
      visualProbability,
      auditoryProbability,
      kinestheticProbability,
      predominantConfidence,
      profileType,
      isMixedProfile,
      classifierType,
    } = lambdaResult
      ? lambdaResult
      : this.buildSimpleScoreResult(txResult);

    const mlModelId = classifierType === "xgboost" ? activeModel!.id : null;
    const modelVersion = classifierType === "xgboost" ? activeModel!.version : null;

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
    } catch {
      aiFeedback = this.getPredefinedFeedback(predominantStyle);
      feedbackSource = "predefined";
    }

    // Save Result + Notification
    const result = await this.resultRepository.saveWithNotification({
      questionnaireId: id,
      studentId,
      mlModelId,
      predominantStyle,
      secondaryStyle,
      visualProbability,
      auditoryProbability,
      kinestheticProbability,
      predominantConfidence,
      profileType,
      isMixedProfile,
      classifierType,
      modelVersion,
      aiFeedback,
      feedbackSource,
    });

    return {
      resultId: result.id,
      predominantStyle,
      secondaryStyle,
      visualProbability,
      auditoryProbability,
      kinestheticProbability,
      predominantConfidence,
      profileType,
      isMixedProfile,
      classifierType,
      aiFeedback,
      feedbackSource,
    };
  }

  private buildSimpleScoreResult(
    tx: CompleteWithAnswersAndDatasetResult,
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
