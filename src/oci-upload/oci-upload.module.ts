import { Module } from "@nestjs/common";
import { OciUploadService } from "./oci-upload.service";
import { OciUploadController } from "./oci-upload.controller";

@Module({
  providers: [OciUploadService],
  controllers: [OciUploadController],
})
export class OciUploadModule {}
