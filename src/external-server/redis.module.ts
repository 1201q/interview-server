import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis, { RedisOptions } from "ioredis";

@Global()
@Module({
  providers: [
    {
      provide: "REDIS_CLIENT",
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const opts: RedisOptions = {
          host: config.get<string>("REDIS_HOST"),
          port: config.get<number>("REDIS_PORT"),
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
          retryStrategy: (times) => Math.min(1000 * 2 ** times, 30_000),
        };

        const client = new Redis(opts);

        client.on("ready", () => console.log("[Redis] ready"));
        client.on("error", (e) => console.log("[Redis] error", e));

        return client;
      },
    },
  ],
  exports: ["REDIS_CLIENT"],
})
export class RedisModule {}
