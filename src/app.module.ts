import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";

import { HttpModule } from "@nestjs/axios";

import { InterviewSessionModule } from "./interview/session/session.module";
import { InterviewAnswerModule } from "./interview/answer/answer.module";
import { FollwupModule } from "./interview/followup/followup.module";

import { TranscribeModule } from "./transcribe/transcribe.module";
import { ExternalServerModule } from "./external-server/external-server.module";
import { GenerateQuestionModule } from "./generate-question/generate-question.module";
import { AnalyzeModule } from "./analyze/analyze.module";
import { BullModule } from "@nestjs/bullmq";
import { BullBoardModule } from "@bull-board/nestjs";
import { ExpressAdapter } from "@bull-board/express";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "oracle",
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECTION,
      autoLoadEntities: true,
      synchronize: false,
      logging: false,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? "redis",
        port: Number(process.env.REDIS_PORT),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    }),
    BullBoardModule.forRoot({
      route: "/admin/queues",
      adapter: ExpressAdapter,
    }),
    HttpModule,
    AuthModule,
    UserModule,
    GenerateQuestionModule,
    InterviewSessionModule,
    InterviewAnswerModule,
    FollwupModule,
    ExternalServerModule,
    TranscribeModule,
    AnalyzeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
