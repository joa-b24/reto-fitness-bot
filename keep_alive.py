from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return "✅ Bot vivo y saludable", 200

@app.route('/ping')
def ping():
    return {"status": "ok", "message": "pong"}, 200

def keep_alive():
    from threading import Thread
    t = Thread(target=lambda: app.run(host="0.0.0.0", port=8080))
    t.start()


