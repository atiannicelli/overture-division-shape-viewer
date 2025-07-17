#!/bin/bash

# Division Shape Viewer Launcher

echo "🗺️  Starting Division Shape Viewer..."

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "🔄 Activating virtual environment..."
    source venv/bin/activate
fi

# Check if dependencies are installed
python -c "import flask" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Dependencies not installed. Running setup..."
    ./setup.sh
    source venv/bin/activate
fi

# Start the server
echo "🚀 Starting server on http://localhost:5000"
echo "📱 Press Ctrl+C to stop the server"
echo ""

python backend.py
