import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlaskService } from "./flask.service";

@Controller("analysis")
export class FlaskController {
  constructor(private readonly analysisService: FlaskService) {}

  // @Post("upload")
  // @UseInterceptors(FileInterceptor("file"))
  // async uploadFile(@UploadedFile() file: Express.Multer.File) {
  //   const text = await this.analysisService.analyze(file);

  //   return { text };
  // }

  // @Post("webhook")
  // async handleWebhook(@Body() body: any) {
  //   const { transcript } = body;

  //   console.log("요청");
  //   console.log(transcript);

  //   return transcript;
  // }
}
