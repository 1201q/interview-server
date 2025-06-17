import asyncio
import websockets
import tempfile
import subprocess
import json
import os
from faster_whisper import WhisperModel

model = WhisperModel("small", device="cpu")


async def handle_client(websocket):
    print("🔗 Client connected")
    buffer = b""

    try:
        async for message in websocket:
            if isinstance(message, str):
                continue  # ignore ping or non-binary

            buffer += message

            # save chunk
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as f:
                f.write(buffer)
                webm_path = f.name
            wav_path = webm_path.replace(".webm", ".wav")

            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    webm_path,
                    "-f",
                    "wav",
                    "-acodec",
                    "pcm_s16le",
                    "-ac",
                    "1",
                    "-ar",
                    "16000",
                    wav_path,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            os.remove(webm_path)

            # STT
            segments, _ = model.transcribe(wav_path, language="ko")
            text = "".join([s.text for s in segments])
            os.remove(wav_path)

            await websocket.send(json.dumps({"text": text}))

    except Exception as e:
        print("❌ Error:", e)

    print("🚪 Client disconnected")


async def main():
    async with websockets.serve(handle_client, "0.0.0.0", 5000, max_size=2**25):
        print("✅ WhisperLive WebSocket STT 서버 시작: ws://localhost:5000")
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
