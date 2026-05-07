from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os
import logging
from typing import Dict, List, Optional
from datetime import datetime

app = FastAPI(title="Predicto Automation API")

# Determine the backend app mode from environment variables
raw_app_mode = os.getenv("APP_MODE") or os.getenv("NODE_ENV") or "production"
APP_MODE = raw_app_mode.lower()
if APP_MODE in ("dev", "development"):
    APP_MODE = "dev"
elif APP_MODE == "local":
    APP_MODE = "local"
else:
    APP_MODE = "prod"

# Setup logging
from automation.logging_config import setup_logging
logger = setup_logging(log_file='logs/automation.log')

# Mount the static files from frontend/ directory
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

print(f"Starting Predictor Manager backend server in {APP_MODE} mode")

# Active WebSocket connections for real-time logs
active_connections: List[WebSocket] = []

@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    """WebSocket endpoint for real-time logs"""
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

@app.get("/api/automation/jobs")
async def list_jobs():
    """List all automation jobs"""
    try:
        from automation.cron.manager import CronManager
        from automation.config.settings import get_config
        
        # Initialize Firebase
        from firebase_manager import FirebaseManager
        fm = FirebaseManager()
        cron_mgr = CronManager(fm)
        
        jobs = cron_mgr.list_jobs()
        return {"jobs": jobs, "count": len(jobs)}
    except Exception as e:
        logger.error(f"Error listing jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/automation/jobs/{job_id}")
async def get_job(job_id: str):
    """Get a specific job"""
    try:
        from automation.cron.manager import CronManager
        from firebase_manager import FirebaseManager
        
        fm = FirebaseManager()
        cron_mgr = CronManager(fm)
        
        job = cron_mgr.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/automation/jobs/{job_id}")
async def update_job(job_id: str, updates: Dict):
    """Update a job (enable/disable/schedule)"""
    try:
        from automation.cron.manager import CronManager
        from firebase_manager import FirebaseManager
        
        fm = FirebaseManager()
        cron_mgr = CronManager(fm)
        
        # Don't allow deleting, only update certain fields
        allowed_fields = {'enabled', 'schedule', 'description'}
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        
        if not filtered_updates:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        success = cron_mgr.update_job(job_id, filtered_updates)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update job")
        
        return {"message": "Job updated successfully", "job_id": job_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/automation/jobs/{job_id}/run")
async def run_job(job_id: str):
    """Manually run a job"""
    try:
        from automation.cron.manager import CronManager
        from automation.cron.scheduler import Scheduler
        from automation.cron.tasks import registry
        from firebase_manager import FirebaseManager
        
        fm = FirebaseManager()
        cron_mgr = CronManager(fm)
        scheduler = Scheduler(cron_mgr, registry)
        
        logger.info(f"Manually running job: {job_id}")
        success = scheduler.run_job_now(job_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to run job")
        
        return {"message": "Job triggered successfully", "job_id": job_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/automation/logs")
async def get_logs(lines: int = 100):
    """Get recent logs"""
    try:
        log_file = 'logs/automation.log'
        if not os.path.exists(log_file):
            return {"logs": [], "message": "No logs found"}
        
        with open(log_file, 'r') as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
        
        return {"logs": [line.strip() for line in recent_lines], "count": len(recent_lines)}
    except Exception as e:
        logger.error(f"Error reading logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4173)
