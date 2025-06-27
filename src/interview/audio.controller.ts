import { Controller, Get, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { OciUploadService } from "src/shared/oci-upload/oci-upload.service";
import { HttpService } from "@nestjs/axios";
import { InterviewService } from "./interview.service";

@Controller("audio")
export class AudioController {
  constructor(
    private readonly ociUploadService: OciUploadService,
    private readonly httpService: HttpService,
    private readonly interviewService: InterviewService,
  ) {}

  @Get(":question_id")
  async getAudio(
    @Param("question_id") question_id: string,
    @Res() res: Response,
  ) {
    const objectName = await this.interviewService.getAudioPath(question_id);

    const audioUrl =
      await this.ociUploadService.generatePresignedUrl(objectName);

    const response = await this.httpService.axiosRef.get(audioUrl, {
      responseType: "stream",
    });

    res.setHeader("Content-Type", "audio/webm");

    response.data.pipe(res);
  }
}
