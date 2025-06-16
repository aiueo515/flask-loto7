from flask import Flask, render_template, jsonify, request
from models.prediction_system import PredictionSystem
import threading
import os
import json

app = Flask(__name__)
system = PredictionSystem()

# ステータスファイルのパス
STATUS_FILE = "learning_status.json"

# 初期状態をセット
def init_status():
    if not os.path.exists(STATUS_FILE):
        with open(STATUS_FILE, "w") as f:
            json.dump({"status": "idle"}, f)

def update_status(new_status):
    with open(STATUS_FILE, "w") as f:
        json.dump({"status": new_status}, f)

def get_status():
    if not os.path.exists(STATUS_FILE):
        return "unknown"
    with open(STATUS_FILE, "r") as f:
        return json.load(f).get("status", "unknown")

# 非同期で学習処理を実行する関数
def run_learning():
    try:
        update_status("running")
        system.run_auto_verification_learning()
        update_status("done")
    except Exception as e:
        update_status(f"error: {str(e)}")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/start-learning", methods=["POST"])
def start_learning():
    if get_status() == "running":
        return jsonify({"status": "already running"})

    thread = threading.Thread(target=run_learning)
    thread.start()
    return jsonify({"status": "started"})

@app.route("/learning-status", methods=["GET"])
def learning_status():
    return jsonify({"status": get_status()})

if __name__ == "__main__":
    init_status()
    app.run(debug=True)

@app.route('/manifest.json')
def manifest():
    """PWA Manifest"""
    return send_from_directory('static', 'manifest.json')

@app.route('/sw.js')
def service_worker():
    """Service Worker"""
    response = send_from_directory('static', 'sw.js')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response