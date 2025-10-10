import { InterviewSession } from "@/common/entities/entities";
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
export class SessionPrepFlowService {
  constructor(
    @InjectFlowProducer("sessionFlow") private readonly flow: FlowProducer,
    @InjectRepository(InterviewSession)
    private readonly repo: Repository<InterviewSession>,
  ) {}

  async start(sessionId: string) {
    const tree = await this.flow.add({
      name: "session-root",
      queueName: "session",
      data: { sessionId },
      children: [
        { name: "role-guess", queueName: "session", data: { sessionId } },
        { name: "rubric-all", queueName: "session", data: { sessionId } },
      ],
    });

    const childrenArray = tree.children ?? [];
    const childIds = Object.fromEntries(
      childrenArray.map((node) => [node.job.name, node.job.id]),
    );

    await this.repo
      .createQueryBuilder()
      .update(InterviewSession)
      .set({
        rubric_gen_status: "processing",
      })
      .where("id = :id", { id: sessionId })
      .execute();

    return { parentJobId: tree.job.id, children: childIds };
  }
}
