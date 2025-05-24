import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}
  getHello(): string {
    return "wow! ✅✅";
  }

  async getTest() {
    const baseUrl = this.configService.get<string>("ML_SERVER_URL");

    try {
      const response = await firstValueFrom(this.httpService.get(`${baseUrl}`));
      return response.data;
    } catch (error) {
      console.error("ML 서버 요청 실패:", error.message);
      throw new Error("ML 서버 연결 실패");
    }
  }
}
