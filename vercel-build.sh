#!/bin/bash
# Install Python dependencies
pip install -r requirements.txt

# Create necessary directories
mkdir -p api

# Create a serverless function for Vercel
cat > api/index.py << 'EOL'
from app import app

def handler(request, context):
    with app.app_context():
        return app.full_dispatch_request()()
EOL
