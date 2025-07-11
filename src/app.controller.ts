import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { ConfigService } from "@nestjs/config";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return "1123";
  }

  @Get("test")
  getTest() {
    return this.appService.testRedis();
  }
}
