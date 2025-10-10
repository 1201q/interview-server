import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as FormData from "form-data";
import { lastValueFrom } from "rxjs";
import { Readable } from "stream";
import { OciDBService } from "./oci-db.service";

@Injectable()
export class FlaskServerService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly oci: OciDBService,
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

  async getAnalysisFromObjectName(objectName: string) {
    const baseUrl = this.configService.get<string>("ML_SERVER_URL");
    const presignedUrl = await this.oci.generatePresignedUrl(objectName);

    const body = {
      source: {
        type: "url",
        url: presignedUrl,
      },
    };

    const response = await lastValueFrom(
      this.httpService.post(`${baseUrl}/analyze`, body, {
        headers: { "Content-Type": "application/json" },
      }),
    );

    return response.data;
  }

  async getVoiceMetrics(webm: Express.Multer.File) {
    const baseUrl = this.configService.get<string>("ML_SERVER_URL");

    const form = new FormData();
    form.append("audio", Readable.from(webm.buffer), {
      filename: webm.originalname,
      contentType: webm.mimetype,
    });

    const response = await lastValueFrom(
      this.httpService.post(`${baseUrl}/voice_metrics`, form, {
        headers: form.getHeaders(),
      }),
    );

    return response.data;
  }

  async extractTextFromPDF(
    file: Express.Multer.File,
    decodedFilename: string,
  ): Promise<{ result: string; fallback: string }> {
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

    const { result, fallback } = response.data;

    return { result: this.tidyText(result), fallback: fallback };
  }

  async enqueueAudioJob(dto: { analysisId: string; objectName: string }) {
    const baseUrl = this.configService.get<string>("ML_SERVER_URL");

    const audioUrl = await this.oci.generatePresignedUrl(dto.objectName);

    const body = {
      analysis_id: dto.analysisId,
      audio_url: audioUrl,
      callback_url: `${this.configService.get<string>("NEST_URL")}/analysis/audio/callback`,
    };

    const res = await fetch(`${baseUrl}/audio/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Failed to enqueue audio job: ${res.statusText}`);
    }

    return { enqueued: true };
  }

  tidyText(input: string) {
    let s = input.replace(/\r\n/g, "\n"); // CRLF → LF 통일

    // 앞뒤 공백 제거
    s = s.trim();

    // 숫자만/특수문자만 있는 단독 라인 제거 (페이지 번호 등)
    s = s.replace(/^\s*[\d\|]+\s*$/gm, "");

    // 연속 빈 줄을 하나로 줄이기
    s = s.replace(/\n{2,}/g, "\n\n");

    // 문장 중간의 줄바꿈 → 공백
    // (단, URL, 불릿(-, •, *) 줄은 유지)
    s = s.replace(/([^\.\?\!\)])\n(?!\n|[-•*]|https?:\/\/)/g, "$1 ");

    // 너무 긴 공백 줄 정리
    s = s.replace(/[ \t]+/g, " ");

    return s.trim();
  }
}
