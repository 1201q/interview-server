import { AnalysisEvent } from "@/common/types/analysis.events.types";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Subject, Observable, map } from "rxjs";

type Key = string;
type Listener = Subject<AnalysisEvent>;

@Injectable()
export class AnalysisEventsService implements OnModuleDestroy {
  private streams = new Map<Key, Listener>();

  stream(sessionId: string): Observable<MessageEvent> {
    const subj = this.ensure(sessionId);

    return subj
      .asObservable()
      .pipe(map((data) => ({ data: JSON.stringify(data) }) as MessageEvent));
  }

  emit(sessionId: string, event: AnalysisEvent) {
    this.ensure(sessionId).next(event);
  }

  private ensure(sessionId: string): Listener {
    let s = this.streams.get(sessionId);
    if (!s) {
      s = new Subject<AnalysisEvent>();
      this.streams.set(sessionId, s);
    }
    return s;
  }

  onModuleDestroy() {
    this.streams.forEach((s) => s.complete());
    this.streams.clear();
  }
}
