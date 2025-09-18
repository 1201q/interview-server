import { Injectable, Inject } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, FlowProducer, FlowJob } from "bullmq";
import { AnswerAnalysisRepository } from "../repos/answer.analysis.repository";

@Injectable()
export class AnalysisOrchestratorService {
  constructor(
    private readonly aaRepo: AnswerAnalysisRepository,
    @InjectQueue("audio") private readonly audioQ: Queue,
    @Inject(FlowProducer) private readonly flow: FlowProducer,
  ) {}

  async start(answerId: string) {
    const aa = await this.aaRepo.ensureOne(answerId);
    const analysisId = aa.id;

    // 텍스트 분석 체인
    // stt -> refine -> feedback
    await this.flow.add({
      name: `final-text:${analysisId}`,
      queueName: "feedback",
      data: { analysisId, answerId },
      children: [
        {
          name: "refine",
          queueName: "refine",
          data: { analysisId, answerId },
          children: [
            { name: "stt", queueName: "stt", data: { analysisId, answerId } },
          ],
        },
      ],
    } as FlowJob);

    // 오디오 병렬 분석 시작 (flask)
    await this.audioQ.add(
      "audio",
      { analysisId, answerId },
      {
        jobId: `audio:${analysisId}`,
        attempts: 3,
        backoff: { type: "exponential" },
        delay: 2000,
      },
    );

    return { analysisId };
  }

  async startAudioOnly(input: { answerId: string; objectName: string }) {
    const { answerId, objectName } = input;

    // answerAnal
    const aa = await this.aaRepo.ensureOne(answerId);

    console.log(aa);

    await this.audioQ.add(
      "audio",
      {
        analysisId: aa.id,
        answerId,
        objectName,
      },
      {
        jobId: `audio:${aa.id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
      },
    );
  }
}
