import { Module } from "@nestjs/common";
import { FlaskService } from "./flask.service";
import { HttpModule } from "@nestjs/axios";
import { OciUploadModule } from "../oci-upload/oci-upload.module";

@Module({
  imports: [HttpModule],
  providers: [FlaskService],
  exports: [FlaskService],
})
export class FlaskModule {}
