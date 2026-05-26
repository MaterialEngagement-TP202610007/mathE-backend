export abstract class VakFeedbackAdapter {
  abstract generateFeedback(
    predominantStyle: string,
    visualProbability: number,
    auditoryProbability: number,
    kinestheticProbability: number,
  ): Promise<string>;
}
