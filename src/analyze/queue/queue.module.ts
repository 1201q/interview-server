import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { JobsService } from "./jobs.service";
import { QueueController } from "./queue.controller";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "analysis",
    }),
    BullBoardModule.forFeature({
      name: "analysis",
      adapter: BullMQAdapter,
    }),
  ],
  providers: [JobsService],
  controllers: [QueueController],
  exports: [JobsService],
})
export class QueueModule {}
