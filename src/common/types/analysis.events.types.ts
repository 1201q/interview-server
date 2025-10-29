export type AnalysisStage = "stt" | "refine" | "audio" | "feedback" | "overall";

export type AnalysisEvent =
  | { type: "started"; session_id: string; answer_id?: string; payload?: any }
  | {
      type: "progress";
      session_id: string;
      answer_id: string;
      stage: AnalysisStage;
      value: number;
    }
  | { type: "status_update"; session_id: string; payload?: any }
  | { type: "completed"; session_id: string; answer_id: string }
  | { type: "failed"; session_id: string; answer_id: string; reason?: string }
  | { type: ":heartbeat"; session_id: string; ts: number };
