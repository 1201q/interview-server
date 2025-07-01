import { Body, Controller, Get, Post, Query } from "@nestjs/common";

import { ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { VectorStoreService } from "./vector-store.service";

@Controller("vector")
@ApiTags("vector")
export class VectorStoreController {
  constructor(private readonly vectorStoreService: VectorStoreService) {}

  @Post("vectorize")
  @ApiOperation({ summary: "이력서/채용공고 벡터화 및 저장" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        resume: { type: "string", description: "이력서 텍스트" },
        job: { type: "string", description: "채용공고 텍스트" },
      },
      required: ["resume", "job"],
    },
  })
  async vectorize(@Body() dto: { resume: string; job: string }) {
    return await this.vectorStoreService.save(
      dto.resume,
      dto.job,
      "1201q",
      "wow",
    );
  }

  @Get("similar")
  @ApiOperation({ summary: "유사 문서 검색" })
  @ApiQuery({ name: "q", required: true, description: "검색 쿼리 (답변 등)" })
  @ApiQuery({ name: "requestId", required: true, description: "고유 식별자" })
  async search(
    @Query("q") query: string,
    @Query("requestId") requestId: string,
  ) {
    const results = await this.vectorStoreService.similaritySearch(
      query,
      requestId,
      2,
      "resume",
    );
    return results.map((d) => d.pageContent);
  }
}
