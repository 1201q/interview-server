import { Module } from "@nestjs/common";

import { AuthModule } from "src/auth/auth.module";

import { TranscribeService } from "./transcribe.service";
import { TranscribeController } from "./transcribe.controller";

@Module({
  imports: [AuthModule],
  providers: [TranscribeService],
  controllers: [TranscribeController],
})
export class TranscribeModule {}
