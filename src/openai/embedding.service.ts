import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

@Injectable()
export class EmbeddingService {
  private client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get("OPENAI_API_KEY"),
    });
  }

  async save({
    resumeText,
    jobText,
    requestId,
  }: {
    resumeText: string;
    jobText: string;
    requestId: string;
  }) {
    const store = await this.client.vectorStores.create({
      name: `aiterview-${requestId}`,
    });

    const resumeFileLike = await toFile(
      Buffer.from(resumeText ?? "", "utf-8"),
      `resume-${requestId}.txt`,
      { type: "text/plain" },
    );

    const jobFileLike = await toFile(
      Buffer.from(jobText ?? "", "utf8"),
      `job-${requestId}.txt`,
      { type: "text/plain" },
    );

    try {
      const resumeFile = await this.client.files.create({
        file: resumeFileLike,
        purpose: "assistants",
      });

      const jdFile = await this.client.files.create({
        file: jobFileLike,
        purpose: "assistants",
      });

      await this.client.vectorStores.files.create(store.id, {
        file_id: resumeFile.id,
      });

      await this.client.vectorStores.files.create(store.id, {
        file_id: jdFile.id,
      });

      return {
        storeId: store.id,
        fileIds: { resume: resumeFile.id, job: jdFile.id },
      };
    } catch (error) {}
  }
}
