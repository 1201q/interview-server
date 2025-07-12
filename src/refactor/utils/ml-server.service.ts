import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as FormData from "form-data";
import { lastValueFrom } from "rxjs";
import { Readable } from "stream";

@Injectable()
export class MLServerService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async convertToSeekableWebm(webm: Express.Multer.File) {
    const baseUrl = this.configService.get<string>("ML_SERVER_URL");

    const form = new FormData();
    form.append("file", Readable.from(webm.buffer), {
      filename: webm.originalname,
      contentType: webm.mimetype,
    });

    const response = await lastValueFrom(
      this.httpService.post(`${baseUrl}/convert_seekable`, form, {
        responseType: "arraybuffer",
        headers: form.getHeaders(),
      }),
    );

    return Buffer.from(response.data);
  }

  async extractTextFromPDF(
    file: Express.Multer.File,
    decodedFilename: string,
  ): Promise<{ result: string }> {
    const baseUrl = this.configService.get<string>("ML_SERVER_URL");

    const form = new FormData();
    form.append("file", Readable.from(file.buffer), {
      filename: decodedFilename,
      contentType: file.mimetype,
    });

    const response = await lastValueFrom(
      this.httpService.post(`${baseUrl}/extract_text`, form, {
        headers: form.getHeaders(),
      }),
    );

    return response.data;
  }
}
