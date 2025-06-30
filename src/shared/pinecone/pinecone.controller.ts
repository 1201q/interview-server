import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { PineconeService } from "./pinecone.service";
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

@Controller("pinecone")
@ApiTags("Pinecone")
export class PineconeController {
  constructor(private readonly pineconeService: PineconeService) {}

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
    return await this.pineconeService.saveResumeAndJobTexts(
      dto.resume,
      dto.job,
      "user",
      "ruser",
    );
  }

  @Get("similar")
  @ApiOperation({ summary: "유사 문서 검색" })
  @ApiQuery({ name: "q", required: true, description: "검색 쿼리 (답변 등)" })
  @ApiQuery({ name: "userId", required: true, description: "유저 식별자" })
  async search(@Query("q") query: string, @Query("userId") userId: string) {
    const results = await this.pineconeService.similaritySearch(query, userId);
    return results.map((d) => d.pageContent);
  }
}
