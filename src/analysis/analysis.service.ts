import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as FormData from "form-data";
import { lastValueFrom } from "rxjs";
import { Readable } from "stream";

@Injectable()
export class AnalysisService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async analyze(file: Express.Multer.File) {
    const baseUrl = this.configService.get<string>("ML_SERVER_URL");

    const form = new FormData();
    form.append("file", Readable.from(file.buffer), {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await lastValueFrom(
      this.httpService.post(`${baseUrl}/analyze_answer`, form, {
        headers: form.getHeaders(),
      }),
    );

    return response.data;
  }
}
