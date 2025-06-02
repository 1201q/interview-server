import openai
import os
from dotenv import load_dotenv
import json

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

open_api_key = os.getenv("OPENAI_API_KEY")
client = openai.OpenAI(api_key=open_api_key)


def transcribe_whisper(wav_path: str):
    with open(wav_path, "rb") as f:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="verbose_json",
            language="ko",
            timestamp_granularities=["word", "segment"],
        )
    return transcript.model_dump()


def get_correct_words_with_gpt(
    word_list: list[str], answer: str, question_text: str, job_role: str
):
    prompt = f"""
    당신은 개발 직군의 지원자를 평가하는 AI 면접 답변 평가 시스템입니다.

    아래는 질문에 대한 지원자의 발화로부터 Whisper STT가 추출한 단어 리스트입니다.
    문장의 흐름과 질문의 의도에 맞게 맞춤법이 틀렸거나, 필사가 틀린 단어만 보정하세요.
	해당 단어의 리스트를 통해 클라이언트에서 오디오 재생에 따라 현재 단어가 하이라이트 될 것입니다.

    답변한 질문:
	"{question_text}"
    - 이 질문에 "{job_role}" 직군의 지원자가 답변했습니다.
    
	조건:
	1. 적절한 위치에 쉼표(,)나 마침표(.)를 삽입해 주세요.
	2. 기술 용어는 정확하게 표기해 주세요. 예 async, await, Promise 등....
    3. **기술 용어가 한국어로 잘못 발음되었거나, 철자가 틀린 경우가 가장 많습니다. 원래의 영문 표기나 통용 표기로 복원해 주세요.**
        해당 지원자는 "{job_role}" 직군이므로, "{job_role}" 직군의 지원자가 자주 사용하는 개념의 용어나 라이브러리명이 자주 등장할 것입니다.
        예시: "미니 파일" → "minify", "fromise" -> "Promise", "인포트" -> "import"
    4. 단어 순서를 유지하세요.
	5. **단어 수도 유지하세요. 중간에 절대 새로운 문장이나 단어를 넣지 마세요. 필사가 틀린 단어나 쉼표 마침표만 보정하세요.**
	6. 마크다운 코드 블록은 출력하지 마세요.
    7. **입력 단어의 길이와 출력 단어의 길이가 다르면 안됩니다.**
    8. 한국어를 영문 표기로 치환하는 과정에서 인접한 두 개의 단어를 합쳐서 단어의 수를 줄이지 마세요.
        예시: "터치업", "인사이드" 를 "TouchUpInside"로 합치지 마세요. "TouchUp", "Inside"로 기존의 단어를 치환하세요.
        예시: "아이오", "익셉션처럼" 은 "IOException처럼"으로 합치지 마세요. "IO", "Exception처럼"으로 기존의 단어를 치환하세요.
        예시: "유스", "effect는" 은 "useEffect는"으로 합치지 마세요. "use", "Effect는"으로 기존의 단어를 치환하세요.
                5번 조건을 기억하세요. 'IOException'처럼 영어로 한 단어이더라도 끊어서 작성하세요.

	9. 👇👇👇 반드시 아래 형식의 JSON 배열만 출력하세요. (설명, 코드블럭, 따옴표 금지)
	형식 예시:
	["HTML,", "CSS,", "렌더링합니다."]
	
	입력 단어:
	{word_list}
	"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    content = response.choices[0].message.content.strip()

    try:
        corrected = json.loads(content)
    except json.JSONDecodeError:
        print("형식이 맞지 않는 content:\n", content)
        raise
    return corrected


def feedback_answer_with_gpt(question: str, answer: str, job_role: str):
    prompt = f"""
    당신은 개발 직군의 지원자를 평가하고 피드백해주는 시니어 면접관입니다.

	아래는 지원자의 면접 답변입니다. 실전 상황이라고 가정하고, 지원자에게 실질적인 도움이 될 수 있는 피드백을 제공해주세요.

    직군:
    "{job_role}"
    
    [주의사항]
	1. **답변 시간은 1분입니다. 따라서 모든 세부 내용을 담기는 어렵습니다. 질문의 핵심 의도를 파악하여 평가 기준을 수립하세요.**
	2. 질문이 개념 설명을 요구하는 경우, 실무 경험이 없어도 감점하지 마세요.
	3. 질문이 실무 경험을 묻는 경우, 경험이 없거나 피상적인 경우에는 감점하세요.
	4. 개념 설명형 질문에서는 대안 전략, 실무 도입 여부 등은 평가 기준이 아닙니다.
	5. 오개념이 있다면 반드시 지적해주세요. 
	6. 전체적으로 좋지 않은 답변일 경우, 피드백 설명은 길게 해주세요.

	[피드백 작성 기준]
	1. 피드백은 정중하지만 솔직하게 작성해주세요. "잘 들었습니다" 같은 불필요한 문장은 제외해주세요.
	2. 좋았던 점(`good`)과 아쉬운 점(`bad`)을 각각 1~5개 항목으로 명확하게 작성해주세요.
	- 각각 문장 단위로 작성하며, "개념 부족" 같은 단답형 표현은 피해주세요.
	- `bad` 항목은 최소 두 문장 이상, 구체적인 설명을 포함하세요.
	3. 답변의 전반적인 수준을 다음 중 하나로 평가하세요, 다만 답변의 제한시간이 1분이라는 점을 고려하세요:
	- A (우수): 질문 의도에 매우 잘 부합하고, 핵심 개념과 실무적 통찰이 포함됨.
	- B (양호): 대부분 정확하나 핵심적인 보완 포인트가 있음.
	- C (보통): 일부 중요한 요소가 빠지거나 개념 전달이 부족함.
	- D (미흡): 오개념이 있거나 질문을 제대로 이해하지 못한 경우.

	질문:
	"{question}"

	답변: 
	- 해당 답변은 Whisper를 통해 필사되었습니다. 일부 단어가 맞춤법이 틀리거나 발음 기반으로 잘못 기록됐을 수 있습니다. 맥락을 고려하여 평가해주세요.
	"{answer}"

	[반환 형식]
	아래 JSON 형식만 반환하세요. 마크다운 코드블록 없이 출력해주세요.
	모든 문장은 존댓말 형태(입니다, 습니다)로 작성해주세요.
	{{
		"feedback": "전체 피드백 내용",
		"good": ["좋았던 점 1", "좋았던 점 2", "..."],
		"bad": ["개선이 필요한 점 1", "개선이 필요한 점 2", "..."],
		"grade": "A~D"
	}}
	"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )

    content = response.choices[0].message.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1].strip()

    try:
        corrected = json.loads(content)
    except json.JSONDecodeError:
        print("형식이 맞지 않는 content:\n", content)
        raise
    return corrected
