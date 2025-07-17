# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for DuckDB and other packages
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies with increased memory for DuckDB
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create a non-root user but keep files accessible
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser:appuser /app

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Switch to non-root user
USER appuser

# Expose port (Fly.io will use internal_port from fly.toml)
EXPOSE 8080

# Health check (using Python instead of curl for simplicity)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health')" || exit 1

# Start the application
CMD ["python", "backend.py"]
