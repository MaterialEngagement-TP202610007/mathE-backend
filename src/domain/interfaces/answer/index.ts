export interface CreateAnswerData {
  questionnaireId: number;
  questionId: number;
  selectedOptionId: number | null;
  navigationSequence: number | null;
  questionTimeSeconds: number | null;
  numberOfChanges: number | null;
  numberOfClicks: number | null;
  timesReviewed: number | null;
}

export interface AnswerWithVakOption {
  id: number;
  questionnaireId: number;
  questionId: number;
  selectedOptionId: number | null;
  vakValue: string | null;
  questionTimeSeconds: number | null;
  numberOfChanges: number | null;
  numberOfClicks: number | null;
}
