# ==============================================================================
# KAVAAI SOVEREIGN — ON-PREMISE CONTAINER DOCKERFILE
# SIH26117: Sovereign On-Premise Agentic AI Workbench for Confidential Work
# Base: Python 3.12 Slim (Debian Bookworm)
# ==============================================================================

FROM python:3.12-slim

# Set strict production environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    AIR_GAP_STRICT_MODE=true \
    OLLAMA_BASE_URL=http://host.docker.internal:11434 \
    OLLAMA_HOST=http://host.docker.internal:11434 \
    OLLAMA_MODEL=qwen2.5:7b

WORKDIR /app

# Install system runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python application dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy application files
COPY . .

# Pre-create all required persistent runtime directories
RUN mkdir -p output workspace/output chroma_db knowledge_base data

# Expose primary application port
EXPOSE 8000

# Container Healthcheck against native /api/system/status endpoint
HEALTHCHECK --interval=25s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/api/system/status || exit 1

# Launch Sovereign Workbench server
CMD ["python", "backend/main.py"]
