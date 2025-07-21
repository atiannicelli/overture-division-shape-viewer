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

# Copy application files
COPY backend.py .
COPY index.html .
COPY script.js .
COPY styles.css .
COPY config.json .

# Expose the port
EXPOSE 4000

# Set environment variables
ENV FLASK_APP=backend.py
ENV FLASK_ENV=production

# Run the application
CMD ["python", "backend.py"]
