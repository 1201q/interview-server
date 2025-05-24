from flask import Flask, request, jsonify
import requests
from datetime import datetime

app = Flask(__name__)

@app.route('/analyze', methods=['POST'])
def analyze():
  data = request.json
  print(f"받은 데이터 : {data}")

  nestjs_url = "http://interview:8000/api/ml-callback"
  try:
    res = requests.post(nestjs_url, json=data)
    return jsonify({"status" : "ok", "response" : res.json()})
  except Exception as e:
    return jsonify({"status" : "fail", "error" : str(e)}), 500
  

if __name__ == "__main__":
  app.run(host='0.0.0.0', port=5000)