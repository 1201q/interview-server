import { Module } from "@nestjs/common";
import { OracledbService } from "./oracledb.service";
import { OracledbController } from "./oracledb.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RoleQuestion } from "./entities/question.entity";

@Module({
  imports: [TypeOrmModule.forFeature([RoleQuestion])],
  providers: [OracledbService],
  controllers: [OracledbController],
})
export class OracledbModule {}
