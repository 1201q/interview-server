import { Module } from "@nestjs/common";
import { RoleQuestion } from "./entities/question.entity";
import { QuestionService } from "./question.service";
import { QuestionController } from "./question.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtAuthGuard } from "src/auth/guard/jwt-auh.guard";
import { AuthService } from "src/auth/auth.service";
import { AuthModule } from "src/auth/auth.module";

@Module({
  imports: [TypeOrmModule.forFeature([RoleQuestion]), AuthModule],
  providers: [QuestionService],
  controllers: [QuestionController],
})
export class QuestionModule {}
