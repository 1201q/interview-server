import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";
import { QuestionModule } from "./question/question.module";
import { SttModule } from "./stt/stt.module";
import { RedisModule } from "./common/redis/redis.module";
import { InterviewModule } from "./interview/interview.module";
import { OciUploadModule } from "./oci-upload/oci-upload.module";
import { HttpModule } from "@nestjs/axios";

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
      logging: true,
    }),
    HttpModule,
    AuthModule,
    UserModule,
    QuestionModule,
    SttModule,
    RedisModule,
    InterviewModule,
    OciUploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
