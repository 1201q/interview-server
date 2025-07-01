import { Body, Controller, Get, Post, Query } from "@nestjs/common";

import { ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { LangChainService } from "./langchain.service";

@Controller("openai")
export class OpenaiController {
  constructor(private readonly langchain: LangChainService) {}

  @Post("follow")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        original_question: { type: "string" },
        current_answer: { type: "string" },
        qa_history: { type: "string" },
        requestId: { type: "string" },
      },
      required: [
        "original_question",
        "current_answer",
        "qa_history",
        "requestId",
      ],
    },
  })
  async follow(@Body() body: any) {
    return this.langchain.generateFollowup({
      original_question: body.original_question,
      current_answer: body.current_answer,
      qa_history: body.qa_history,
      requestId: body.requestId,
    });
  }
}
