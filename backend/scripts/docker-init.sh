#!/bin/bash

# Docker initialization script for OverlayChat backend
set -e

echo "🚀 Initializing OverlayChat Backend Automation..."

# Wait for Firebase to be ready
echo "⏳ Waiting for Firebase emulator..."
until curl -f http://localhost:9000/.health/readinessz 2>/dev/null; do
  sleep 2
done

echo "✅ Firebase emulator is ready!"

# Initialize database
echo "📊 Initializing automation database..."
python -c "
import sqlite3
import os
from datetime import datetime

# Create database directory if it doesn't exist
os.makedirs('/app/data', exist_ok=True)

# Initialize database
conn = sqlite3.connect('/app/automation_jobs.db')
cursor = conn.cursor()

# Create tables if they don't exist
cursor.execute('''
CREATE TABLE IF NOT EXISTS automation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    task_id TEXT,
    session_id TEXT
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS task_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL,
    duration REAL,
    error_message TEXT
)
''')

conn.commit()
conn.close()

print('✅ Database initialized successfully!')
"

# Set proper permissions
chmod 755 /app/data
chmod 644 /app/automation_jobs.db

echo "🎯 Backend initialization complete!"
