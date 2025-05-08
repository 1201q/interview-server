import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class InterviewService {
  constructor(@Inject("REDIS_CLIENT") private readonly redis: Redis) {}

  async testRedis(): Promise<string> {
    await this.redis.set("test", "hello redis!");
    const value = await this.redis.get("test");

    return value;
  }
}
