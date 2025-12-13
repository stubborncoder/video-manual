# vDocs Backend Dockerfile
# Python 3.13 with FFmpeg and WeasyPrint dependencies

FROM python:3.13-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_SYSTEM_PYTHON=1

# Install system dependencies
# - FFmpeg: video processing
# - WeasyPrint deps: cairo, pango, gdk-pixbuf for PDF generation
# - OpenCV deps: libgl1, libglib2.0
# - curl: health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install UV package manager
RUN pip install uv

WORKDIR /app

# Copy dependency files first for better caching
COPY pyproject.toml uv.lock* ./

# Install dependencies
RUN uv sync --frozen --no-dev 2>/dev/null || uv sync --no-dev

# Copy application code
COPY src/ ./src/

# Create data directories
RUN mkdir -p /data/users /data/checkpoints /data/templates

# Set data directory
ENV VDOCS_DATA_DIR=/data

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the API server
CMD ["uv", "run", "vdocs-api", "--host", "0.0.0.0", "--port", "8000"]
