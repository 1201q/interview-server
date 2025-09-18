import { Injectable } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";

import { ConfigService } from "@nestjs/config";
import { OciDBService } from "src/external-server/oci-db.service";

@Injectable()
@Processor("audio", { concurrency: 1 })
export class AudioWorker extends WorkerHost {
  constructor(
    private readonly cfg: ConfigService,
    private readonly oci: OciDBService,
  ) {
    super();
  }

  async process(
    job: Job<{ analysisId: string; answerId: string; objectName: string }>,
  ) {
    const { analysisId, answerId, objectName } = job.data;

    const par = await this.oci.generatePresignedUrl(objectName);
    console.log(par);

    const callbackURL = "";
    return { enqueued: true, analysisId, answerId, callbackURL };
  }
}
