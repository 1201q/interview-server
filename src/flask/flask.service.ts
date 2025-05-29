import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as FormData from "form-data";
import { lastValueFrom } from "rxjs";
import { EvaluationStandard } from "src/common/interfaces/analysis.interface";
import { Readable } from "stream";

@Injectable()
export class FlaskService {
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

  async sendToAnalysisServer(
    webm: Express.Multer.File,
    questionId: string,
    standard: EvaluationStandard,
  ) {
    const baseUrl = this.configService.get<string>("ML_SERVER_URL");

    const form = new FormData();
    form.append("file", Readable.from(webm.buffer), {
      filename: webm.originalname,
      contentType: webm.mimetype,
    });

    form.append("question_id", questionId);
    form.append("evaluation_standard", JSON.stringify(standard));

    await lastValueFrom(
      this.httpService.post(`${baseUrl}/analyze_answer`, form, {
        headers: form.getHeaders(),
      }),
    );
  }
}
