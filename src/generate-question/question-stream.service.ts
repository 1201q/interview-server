import { Injectable, Logger } from "@nestjs/common";
import { QuestionRequestService } from "./question-request.service";
import { QuestionGenerationPipeline } from "./question-generation.pipeline";
import { EventStreamService } from "./event-stream.service";
import { Response } from "express";
import { QuestionItem } from "@/common/schemas/prompt.schema";
import { MOCK_QUESTIONS } from "@/common/constants/mock-question";

@Injectable()
export class QuestionStreamService {
  private readonly logger = new Logger(QuestionStreamService.name);

  constructor(
    private readonly requests: QuestionRequestService,
    private readonly pipeline: QuestionGenerationPipeline,
    private readonly events: EventStreamService,
  ) {}

  async stream(requestId: string, res: Response) {
    const request = await this.requests.markWorking(requestId);

    let closed = false;
    let clientClosed = false;

    const safeEnd = (hb?: NodeJS.Timeout) => {
      if (!closed) {
        closed = true;
        if (hb) clearInterval(hb);
        if (!res.writableEnded) res.end();
      }
    };

    const heartbeat = this.events.startHeartbeat(res);
    this.events.write(res, { retryMs: 1000 });

    const limits = { basic: 3, experience: 6, job_related: 5, expertise: 6 };
    const { stream, pipeline, pt, limitCount } = this.pipeline.createStream(
      request.resume_text,
      request.job_text,
      limits,
    );

    let createdTotal = 0;
    let eid = 0;
    const nextId = () => ++eid;

    pipeline.on("data", ({ value }) => {
      if (clientClosed) return; // client가 닫힌 경우 무시

      try {
        const item = QuestionItem.parse(value);
        createdTotal += 1;

        this.events.write(res, {
          id: nextId(),
          event: "question",
          data: { type: "question", ...item },
        });

        this.events.write(res, {
          id: nextId(),
          event: "progress",
          data: { type: "progress", limitCount, createdTotal },
        });

        this.logger.log(`Question generated: ${JSON.stringify(item)}`);
      } catch {
        this.events.write(res, {
          id: nextId(),
          event: "warn",
          data: { reason: "schema_invalid" },
        });
      }
    });

    pipeline.on("end", async () => {
      if (clientClosed) {
        safeEnd(heartbeat);
        return;
      }

      try {
        const questions = await this.pipeline.getFinalQuestions(stream);
        await this.requests.completeWithQuestions(request, questions);

        this.events.write(res, {
          id: nextId(),
          event: "completed",
          data: { type: "completed", msg: "[DONE]" },
        });
      } catch (e) {
        this.logger.error(e);
        await this.requests.fail(request);
        this.events.write(res, {
          id: nextId(),
          event: "failed",
          data: { type: "failed", reason: "db_error", msg: String(e) },
        });
      } finally {
        safeEnd(heartbeat);
      }
    });

    pipeline.on("error", async (err) => {
      this.logger.error(err);

      // 클라가 닫힌 경우에는 더 이상 처리하지 않음
      if (!clientClosed) {
        await this.requests.fail(request);
        this.events.write(res, {
          id: nextId(),
          event: "failed",
          data: { reason: "parse_error", msg: String(err) },
        });
      }

      safeEnd(heartbeat);
    });

    res.on("close", () => {
      clientClosed = true;
      try {
        // (stream as any).abort?.();
        // abort 호출시 터짐
        pt.destroy();
      } catch {}
      safeEnd(heartbeat);
    });

    stream.on("error", async (err) => {
      this.logger.error(err);
      await this.requests.fail(request);
      this.events.write(res, {
        id: nextId(),
        event: "failed",
        data: { reason: "openai_stream_error", msg: String(err) },
      });
      safeEnd(heartbeat);
    });
  }

  async streamMockData(res: Response) {
    await new Promise((r) => setTimeout(r, 3000));

    const heartbeat = this.events.startHeartbeat(res, 15000);

    let closed = false;
    const safeEnd = () => {
      if (!closed) {
        closed = true;
        clearInterval(heartbeat);
        if (!res.writableEnded) res.end();
      }
    };

    this.events.write(res, { retryMs: 1000 });

    let eid = 0;
    const nextId = () => ++eid;

    const limitCount = 5;

    try {
      for (let i = 0; i < limitCount; i++) {
        const item = MOCK_QUESTIONS[i];

        this.events.write(res, {
          id: nextId(),
          event: "question",
          data: { type: "question", ...item },
        });
        this.events.write(res, {
          id: nextId(),
          event: "progress",

          data: {
            type: "progress",
            ...{ limitCount, createdTotal: i + 1 },
          },
        });

        await new Promise((r) => setTimeout(r, 1000));
      }

      this.events.write(res, {
        id: nextId(),
        event: "completed",
        data: { type: "completed", msg: "[DONE]" },
      });
    } catch (e) {
      this.events.write(res, {
        id: nextId(),
        event: "failed",
        data: { reason: "mock_error", msg: String(e), type: "failed" },
      });
    } finally {
      safeEnd();
    }
  }
}
