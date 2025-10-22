import { Module } from "@nestjs/common";
import { UserService } from "./user.service";

import { TypeOrmModule } from "@nestjs/typeorm";
import { InterviewUser } from "./entities/user.entity";

import { AuthModule } from "@/auth/auth.module";

@Module({
  imports: [TypeOrmModule.forFeature([InterviewUser])],
  providers: [UserService],

  exports: [UserService],
})
export class UserModule {}
