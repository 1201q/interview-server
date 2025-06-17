import { Module } from "@nestjs/common";
import { SttController } from "./stt.controller";
import { SttService } from "./stt.service";

import { AuthModule } from "src/auth/auth.module";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [AuthModule, HttpModule],
  controllers: [SttController],
  providers: [SttService],
})
export class SttModule {}
