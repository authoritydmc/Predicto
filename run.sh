#!/bin/bash

echo "=========================================="
echo "   OverlayChat Management Console"
echo "=========================================="
echo ""
echo "[1] Start Host App (Broadcaster Electron + Python)"
echo "[2] Start Audience App (React Web Dev Mode)"
echo "[3] Deploy Production (Frontend + Firebase)"
echo "[4] Clean Root node_modules (Maintenance)"
echo "[5] Exit"
echo ""
read -p "Select an option (1-5): " opt

case $opt in
    1)
        cd backend
        [ ! -d "node_modules" ] && npm install
        npm start
        ;;
    2)
        cd frontend
        [ ! -d "node_modules" ] && npm install
        npm run dev
        ;;
    3)
        cd backend
        npm run deploy
        ;;
    4)
        pkill -f electron
        rm package.json package-lock.json 2>/dev/null
        rm -rf node_modules 2>/dev/null
        echo "Cleanup finished."
        ;;
    5)
        exit 0
        ;;
    *)
        echo "Invalid option."
        ;;
esac
