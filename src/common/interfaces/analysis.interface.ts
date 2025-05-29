export interface EvaluationType {
  [key: string]: string;
}

export interface QuestionEvaluation {
  question_id: string;
  question_text: string;
  intent: string;
  core_criteria: EvaluationType;
  supplementary_criteria: EvaluationType;
  expected_keywords: string[];
}

export interface EvaluationStandard {
  job_role: string;
  question_evaluations: QuestionEvaluation[];
}
