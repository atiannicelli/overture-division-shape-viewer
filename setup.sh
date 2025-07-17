#!/bin/bash

# Division Shape Viewer Setup Script

echo "🗺️  Setting up Division Shape Viewer..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip is not installed. Please install pip first."
    exit 1
fi

# Create virtual environment (optional but recommended)
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo "📥 Installing Python dependencies..."
pip install -r requirements.txt

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ Setup completed successfully!"
    echo ""
    echo "🚀 To run the application:"
    echo "   1. Activate the virtual environment: source venv/bin/activate"
    echo "   2. Run the server: python backend.py"
    echo "   3. Open your browser to: http://localhost:5000"
    echo ""
    echo "🔧 To integrate with real Overture Maps data:"
    echo "   See the README.md file for detailed instructions"
else
    echo "❌ Setup failed. Please check the error messages above."
    exit 1
fi
