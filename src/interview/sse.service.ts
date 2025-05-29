import { Injectable } from "@nestjs/common";
import { Observable, Subject } from "rxjs";

@Injectable()
export class SseService {
  private streams = new Map<string, Subject<any>>();

  getInterviewSeesionStatusStream(sessionId: string): Observable<any> {
    if (!this.streams.has(sessionId)) {
      this.streams.set(sessionId, new Subject());
    }

    return this.streams.get(sessionId).asObservable();
  }

  notifyStatus(sessionId: string, data: any) {
    this.streams.get(sessionId)?.next(data);
  }
}
