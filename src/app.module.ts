import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";
import { QuestionGeneratorModule } from "./question-generator/question-generator.module";
import { SttModule } from "./stt/stt.module";
import { RedisModule } from "./common/redis/redis.module";
import { InterviewModule } from "./interview/interview.module";
import { OciUploadModule } from "./shared/oci-upload/oci-upload.module";
import { HttpModule } from "@nestjs/axios";
import { FlaskModule } from "./shared/flask/flask.module";
import { OpenaiModule } from "./shared/openai/openai.module";

import { VectorStoreModule } from "./shared/vector-store/vector-store.module";
import { GenerateRequestModule } from "./refactor/generate-request/generate-request.module";
import { InterviewSessionModule } from "./refactor/interview-session/interview-session.module";

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
    HttpModule,
    AuthModule,
    UserModule,
    QuestionGeneratorModule,
    SttModule,
    RedisModule,
    InterviewModule,
    OciUploadModule,
    FlaskModule,
    OpenaiModule,

    VectorStoreModule,
    GenerateRequestModule,
    InterviewSessionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
