import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { SttService } from "./stt.service";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("stt")
export class SttController {
  constructor(private readonly sttService: SttService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const text = await this.sttService.transcribe(file);

    return { text };
  }
}
