import { Module } from "@nestjs/common";
import { OciUploadService } from "./oci-upload.service";
import { OciUploadController } from "./oci-upload.controller";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [HttpModule],
  providers: [OciUploadService],
  controllers: [OciUploadController],
  exports: [OciUploadService],
})
export class OciUploadModule {}
