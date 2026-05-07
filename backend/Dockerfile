# Dockerfile for Backend (Python FastAPI + Automation)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port 4173
EXPOSE 4173

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=prod

# Run the FastAPI server with automation API
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "4173"]
