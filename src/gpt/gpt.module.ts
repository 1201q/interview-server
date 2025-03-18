import { Module } from '@nestjs/common';
import { GptService } from './gpt.service';
import { GptController } from './gpt.controller';

@Module({
  providers: [GptService],
  controllers: [GptController],
  exports: [GptService],
})
export class GptModule {}
