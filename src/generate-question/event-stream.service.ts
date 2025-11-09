import { Injectable } from "@nestjs/common";
import { Response } from "express";

type WriteEventOpts = {
  id?: string | number;
  event?: string;
  data?: any;

  retryMs?: number;
};

@Injectable()
export class EventStreamService {
  write(res: Response, { id, event, data, retryMs }: WriteEventOpts) {
    if (res.writableEnded) return;

    if (retryMs != null) res.write(`retry: ${retryMs}\n`);

    if (id != null) res.write(`id: ${id}\n`);

    if (event) res.write(`event: ${event}\n`);

    if (data !== undefined) {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      res.write(`data: ${payload}\n\n`);
    } else {
      res.write(`\n`);
    }
  }

  startHeartbeat(res: Response, ms = 15000) {
    return setInterval(() => {
      if (!res.writableEnded) res.write(`:hb ${Date.now()}\n\n`);
    }, ms);
  }
}
