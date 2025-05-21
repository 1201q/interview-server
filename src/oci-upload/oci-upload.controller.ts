import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { OciUploadService } from "./oci-upload.service";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("oci-upload")
export class OciUploadController {
  constructor(private readonly ociUploadService: OciUploadService) {}

  @Post("file")
  @UseInterceptors(FileInterceptor("file"))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const objectName = await this.ociUploadService.uploadFile(file);

    const url = await this.ociUploadService.generatePresignedUrl(objectName);

    return { objectName, url };
  }
}
