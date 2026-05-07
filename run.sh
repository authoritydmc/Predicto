#!/bin/bash
# Predicto Dev Launcher - Linux/Mac Entry Point
# This script launches the Python-based launcher

echo
echo "========================================"
echo "  Predicto Dev Launcher"
echo "========================================"
echo

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed or not in PATH"
    echo "Please install Python 3.7+ and try again"
    exit 1
fi

# Get directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the script directory
cd "$SCRIPT_DIR"

# Run Python launcher with all arguments passed through
python3 launcher.py "$@"

# Check exit code
if [ $? -ne 0 ]; then
    echo
    echo "Launcher exited with error code $?"
    read -p "Press Enter to continue..."
fi
