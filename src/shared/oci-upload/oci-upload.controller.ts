import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { OciUploadService } from "./oci-upload.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlaskService } from "src/shared/flask/flask.service";

@Controller("oci-upload")
export class OciUploadController {
  constructor(
    private readonly ociUploadService: OciUploadService,
    private readonly flaskService: FlaskService,
  ) {}

  @Post("file")
  @UseInterceptors(FileInterceptor("file"))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const convertedBuffer = await this.flaskService.convertToSeekableWebm(file);

    const objectName = await this.ociUploadService.uploadFileFromBuffer(
      convertedBuffer,
      `seekable-${file.originalname}`,
    );

    const url = await this.ociUploadService.generatePresignedUrl(objectName);

    return { objectName, url };
  }
}
