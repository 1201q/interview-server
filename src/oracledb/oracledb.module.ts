import { Module } from "@nestjs/common";
import { OracledbService } from "./oracledb.service";
import { OracledbController } from "./oracledb.controller";

@Module({
  providers: [OracledbService],
  controllers: [OracledbController],
})
export class OracledbModule {}
