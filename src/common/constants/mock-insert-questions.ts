import { QuestionItem } from "../interfaces/common.interface";

export const MOCK_INSERT_QUESTIONS: QuestionItem[] = [
  {
    text: "첫 90일에 이 포지션에서 반드시 달성하고 싶은 한 가지 성과는 무엇인가요?",
    based_on: "basic:intent-90-days",
    section: "basic",
  },
  {
    text: "협업에서 ‘극도의 투명함’을 실천하기 위해 평소에 유지하는 한 가지 루틴을 소개해 주세요.",
    based_on: "basic:transparency-routine",
    section: "basic",
  },
  {
    text: "마이크로서비스 전환 당시 가장 까다로웠던 설계 트레이드오프 하나를 선택한 근거를 설명해 주세요.",
    based_on: "resume:exp#1 - microservices-migration",
    section: "experience",
  },
  {
    text: "예약 시스템에서 최대 인원 초과 동시성 문제 해결 시 최종적으로 선택한 락 전략의 결정 근거를 들려주세요.",
    based_on: "resume:exp#2 - reservation-concurrency",
    section: "experience",
  },
  {
    text: "GAuth 개발에서 토큰 수명/회수 설계와 관련해 가장 큰 보안 이슈 하나를 어떻게 해결했는지 요점을 말해 주세요.",
    based_on: "resume:exp#5 - oauth-gauth",
    section: "experience",
  },
  {
    text: "대규모 실시간 결제 트래픽에서 중복 요청과 재시도를 고려해 결제 API의 멱등성을 어떻게 보장하시겠습니까?",
    based_on: "jd:task#1 - high-availability",
    section: "job_related",
  },
  {
    text: "급격한 트래픽 스파이크 상황에서 쓰로틀링과 큐잉 중 무엇을 우선 적용할지, 선택 기준을 말씀해 주세요.",
    based_on: "jd:task#2 - real-time-traffic",
    section: "job_related",
  },
  {
    text: "결제 승인 경로의 가용성과 지연을 관리하기 위해 SLO를 어떻게 정의하고 어떤 지표로 알람을 구성하시겠습니까?",
    based_on: "jd:task#3 - operations-slo",
    section: "job_related",
  },
  {
    text: "결제 API에서 멱등성 키를 설계할 때 키 스코프와 보관 기간을 어떻게 정하는 것이 바람직하다고 보나요?",
    based_on: "concept:idempotency-keys",
    section: "expertise",
  },
  {
    text: "분산 트랜잭션에서 saga 패턴과 two-phase commit 중 선택해야 한다면, 네트워크 분할과 보상 비용을 기준으로 어떤 상황에 무엇을 택하겠습니까?",
    based_on: "concept:saga-pattern-vs-two-phase-commit",
    section: "expertise",
  },
  {
    text: "WebFlux 같은 리액티브 환경에서 소비자가 느릴 때 백프레셔를 구현하는 실용적 전략 한 가지를 설명해 주세요.",
    based_on: "concept:backpressure-in-reactive-streams",
    section: "expertise",
  },
];
