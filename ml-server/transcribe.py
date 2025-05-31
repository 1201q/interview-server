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


# def get_correct_words_with_gpt(word_list: list[str], question: str):
#     prompt = f"""
#     당신은 개발 직군의 지원자를 평가하는 AI 면접 답변 평가 시스템입니다.

#     아래는 질문에 대한 지원자의 발화로부터 Whisper STT가 추출한 단어 리스트입니다.
#     문장의 흐름과 질문의 의도에 맞게 사람이 읽기 좋은 형태로 단어를 보정하세요.
# 	해당 단어의 리스트를 통해 프론트엔드에서 오디오 재생에 따라 현재 단어가 하이라이트 될 것입니다.

#     질문:
# 	"{question}"

# 	조건:
# 	1. 적절한 위치에 쉼표(,)나 마침표(.)를 삽입해 주세요.
# 	2. 기술 용어는 정확하게 표기해 주세요. 예 async, await, Promise 등....
#     3. 기술 용어가 발음이 유사한 한국어로 표시된 경우가 있습니다. 이 경우 맥락과 질문을 고려하여 보정하세요.
#     4. 단어 순서를 유지하세요.
# 	5. 단어 수는 가능한 유지하되, 꼭 필요한 경우만 수정하세요.
# 	6. 마크다운 코드 블록은 출력하지 마세요.
# 	7. 👇👇👇 반드시 아래 형식의 JSON 배열만 출력하세요. (설명, 코드블럭, 따옴표 금지)

# 	형식 예시:
# 	["HTML,", "CSS,", "렌더링합니다."]

# 	입력 단어:
# 	{word_list}
# 	"""

#     response = client.chat.completions.create(
#         model="gpt-4o-mini",
#         messages=[{"role": "user", "content": prompt}],
#         temperature=0.2,
#     )

#     content = response.choices[0].message.content.strip()

#     try:
#         corrected = json.loads(content)
#     except json.JSONDecodeError:
#         print("형식이 맞지 않는 content:\n", content)
#         raise
#     return corrected


def get_correct_words_with_gpt(word_list: list[str], question: str, job_role: str):
    prompt = f"""
    당신은 개발 직군의 지원자를 평가하는 AI 면접 답변 평가 시스템입니다.

    아래는 질문에 대한 지원자의 발화로부터 Whisper STT가 추출한 단어 리스트입니다.
    문장의 흐름과 질문의 의도에 맞게 맞춤법이 틀렸거나, 필사가 틀린 단어만 보정하세요.
	해당 단어의 리스트를 통해 클라이언트에서 오디오 재생에 따라 현재 단어가 하이라이트 될 것입니다.

    질문:
	"{question}"
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
