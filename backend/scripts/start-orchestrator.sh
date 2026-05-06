#!/bin/bash

# Script to start the Windows orchestrator in Docker
set -e

echo "🤖 Starting Windows Orchestrator..."

# Check if Firebase is ready
echo "⏳ Checking Firebase connection..."
if ! curl -f http://localhost:9000/.health/readinessz 2>/dev/null; then
    echo "❌ Firebase emulator not ready!"
    exit 1
fi

echo "✅ Firebase emulator is ready!"

# Start the orchestrator
echo "🚀 Launching automation orchestrator..."
cd /app
python automation/orchestrator/working_windows_orchestrator.py --console-log

echo "🎯 Orchestrator started!"
