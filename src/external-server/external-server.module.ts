import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { FlaskServerService } from "./flask-server.service";
import { OciDBService } from "./oci-db.service";
import { RedisModule } from "./redis.module";
import { VectorStoreService } from "./vector-store.service";

@Module({
  imports: [HttpModule, RedisModule],
  providers: [OciDBService, FlaskServerService, VectorStoreService],
  exports: [OciDBService, FlaskServerService, VectorStoreService],
})
export class ExternalServerModule {}
