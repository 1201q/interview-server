import { AnswerAnalysis } from "@/common/entities/entities";
import { InjectFlowProducer } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { FlowProducer } from "bullmq";
import { Repository } from "typeorm";

type Progress = {
  stt: number;
  refine: number;
  audio: number;
  feedback: number;
};

@Injectable()
export class AnalysisFlowService {
  constructor(
    @InjectFlowProducer("analysisFlow") private readonly flow: FlowProducer,
    @InjectRepository(AnswerAnalysis)
    private readonly repo: Repository<AnswerAnalysis>,
  ) {}

  async addFullFlow(params: {
    sessionId: string;
    answerId: string;
    progress?: Progress;
  }) {
    const progress: Progress = params.progress ?? {
      stt: 20,
      refine: 20,
      audio: 20,
      feedback: 40,
    };

    const tree = await this.flow.add({
      name: "full-root",
      queueName: "analysis",
      data: {
        sessionId: params.sessionId,
        answerId: params.answerId,
        progress: progress,
      },
      children: [
        {
          name: "stt",
          queueName: "analysis",
          data: { answerId: params.answerId },
        },
        {
          name: "refine",
          queueName: "analysis",
          data: { answerId: params.answerId },
        },
        {
          name: "audio-wait",
          queueName: "analysis",
          data: { answerId: params.answerId },
        },
        {
          name: "feedback-gate",
          queueName: "analysis",
          data: { sessionId: params.sessionId, answerId: params.answerId },
        },
      ],
    });

    const childrenArray = tree.children ?? [];
    const childIds = Object.fromEntries(
      childrenArray.map((node) => [node.job.name, node.job.id]),
    );

    console.log(childIds);

    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({
        status: "processing",
        progress: 0,
        bull_job_id: tree.job.id,
      })
      .where("answer_id = :answerId", { answerId: params.answerId })
      .execute();

    return { parentJobId: tree.job.id, children: childIds };
  }
}
