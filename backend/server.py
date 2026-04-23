from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

# Determine the backend app mode from environment variables
raw_app_mode = os.getenv("APP_MODE") or os.getenv("NODE_ENV") or "production"
APP_MODE = raw_app_mode.lower()
if APP_MODE in ("dev", "development"):
    APP_MODE = "dev"
elif APP_MODE == "local":
    APP_MODE = "local"
else:
    APP_MODE = "prod"

# Mount the static files from frontend/ directory
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

print(f"Starting Predictor Manager backend server in {APP_MODE} mode")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4173)
