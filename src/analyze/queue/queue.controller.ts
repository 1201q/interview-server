import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { JobsService } from "./jobs.service";

@ApiTags("큐 테스트")
@Controller("queue")
export class QueueController {
  constructor(private readonly jobsService: JobsService) {}

  @Get("/test")
  async test() {
    this.jobsService.enqueueAnalyze({ answerId: "@!@#!$", url: "!" });
    return "!";
  }
}
