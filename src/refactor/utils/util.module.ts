import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { MLServerService } from "./ml-server.service";
import { OciDBService } from "./oci-db.service";
import { STTService } from "./stt.service";

@Module({
  imports: [HttpModule],
  providers: [OciDBService, MLServerService, STTService],
  controllers: [],
  exports: [OciDBService, MLServerService, STTService],
})
export class UtilModule {}
