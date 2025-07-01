import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import Redis from "ioredis";

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,

    @Inject("REDIS_CLIENT") private readonly redis: Redis,
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

  async testRedis() {
    await this.redis.set("test", "hello redis!!!!!!!!");

    const value = await this.redis.get("test");

    return value;
  }
}
