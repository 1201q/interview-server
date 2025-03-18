import { Body, Controller, Post } from '@nestjs/common';
import { GptService } from './gpt.service';

@Controller('gpt')
export class GptController {
  constructor(private readonly gptService: GptService) {}

  @Post('test')
  async test(@Body('answer') answer: string) {
    const data = await this.gptService.testAnswer(answer);
    return { data };
  }
}
