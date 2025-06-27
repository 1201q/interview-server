import { Module } from "@nestjs/common";
import { OciUploadService } from "./oci-upload.service";
import { OciUploadController } from "./oci-upload.controller";

import { FlaskModule } from "src/shared/flask/flask.module";

@Module({
  imports: [FlaskModule],
  providers: [OciUploadService],
  controllers: [OciUploadController],
  exports: [OciUploadService],
})
export class OciUploadModule {}
