import { Controller, Get } from "@nestjs/common";
import { InterviewService } from "./interview.service";

@Controller("interview")
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Get("test")
  async test() {
    return this.interviewService.testRedis();
  }
}
