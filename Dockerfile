# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for DuckDB compilation
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the index building script and config for building the index
COPY build_index.py .
COPY config.json .

# Build the lightweight divisions index during Docker build (metadata only, no geometry)
# This step is cached and only rebuilt when dependencies or build_index.py changes
RUN python build_index.py

# Copy application files (these changes won't invalidate the index build cache)
COPY backend.py .
COPY index.html .
COPY script.js .
COPY styles.css .

# Set the environment variable to use the pre-built database
ENV DUCKDB_PATH=/app/divisions_index.duckdb

# Expose the port
EXPOSE 4000

# Set environment variables
ENV FLASK_APP=backend.py
ENV FLASK_ENV=production

# Run the application
CMD ["python", "backend.py"]
