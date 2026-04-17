# Use a lightweight Python base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies using standard pip
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend and schedule CSV
COPY backend/ ./backend/
COPY schedule_2026_ipl.csv .

# Set environment
ENV ENVIRONMENT=prod
ENV PYTHONUNBUFFERED=1

# Command to run the monitor script
CMD ["python", "backend/monitor.py"]
