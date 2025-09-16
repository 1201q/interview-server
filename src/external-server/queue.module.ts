import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { FlowProducer } from "bullmq";

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get("REDIS_HOST", "127.0.0.1"),
          port: cfg.get<number>("REDIS_PORT", 6379),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: "stt" },
      { name: "refine" },
      { name: "feedback" },
      { name: "audio" },
    ),
    BullBoardModule.forRoot({
      route: "/admin/queues",
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      {
        name: "stt",
        adapter: BullMQAdapter,
      },
      {
        name: "refine",
        adapter: BullMQAdapter,
      },
      {
        name: "feedback",
        adapter: BullMQAdapter,
      },
      {
        name: "audio",
        adapter: BullMQAdapter,
      },
    ),
  ],
  providers: [
    {
      provide: FlowProducer,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        new FlowProducer({
          connection: {
            host: cfg.get("REDIS_HOST", "127.0.0.1"),
            port: cfg.get<number>("REDIS_PORT", 6379),
          },
        }),
    },
  ],
  controllers: [],
  exports: [FlowProducer, BullModule],
})
export class QueueModule {}
