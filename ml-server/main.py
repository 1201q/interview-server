from flask import Flask
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__)

@app.route('/')
def hello():
  py_test = os.getenv("PY_TEST", "값 없음")
  return f'PY_TEST 환경변수: {py_test}'
  

if __name__ == "__main__":
  app.run(host='0.0.0.0', port=5000)