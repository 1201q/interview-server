import { Module } from "@nestjs/common";
import { UserService } from "./user.service";

import { TypeOrmModule } from "@nestjs/typeorm";
import { InterviewUser } from "./entities/user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([InterviewUser])],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
