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
    const key = this.configService.get("OCI_PRIVATE_KEY").replace(/\\n/g, "\n");

    const rawKey = process.env.OCI_PRIVATE_KEY;
    const privateKey = rawKey?.replace(/\\n/g, "\n").replaceAll(/\\n/g, "");

    console.log(key);

    return key;
  }
}
