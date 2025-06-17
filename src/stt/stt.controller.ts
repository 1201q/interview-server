import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { SttService } from "./stt.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { AuthService } from "src/auth/auth.service";
import { HttpService } from "@nestjs/axios";

@Controller("stt")
export class SttController {
  constructor(
    private readonly sttService: SttService,
    private readonly authService: AuthService,
    private readonly httpService: HttpService,
  ) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const text = await this.sttService.transcribe(file);

    return { text };
  }

  @Post("/realtime/token")
  async createRealtimeToken(@Req() req: Request) {
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const session = await this.sttService.createRealtimeSession();

    console.log(session);
    return session;
  }
}
