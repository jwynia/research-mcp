#!/bin/bash
set -e

# Configuration
SOURCE_DIR="$(pwd)"
TARGET_DIR="../../standalone-dist/research"
DIST_DIR="dist"

echo "Building standalone research MCP server..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"

# Step 1: Clean and create target directory
echo "Cleaning target directory..."
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

# Step 2: Build TypeScript code
echo "Building TypeScript code..."
npm run build

# Step 3: Copy necessary files
echo "Copying files to target directory..."
cp -r "$DIST_DIR" "$TARGET_DIR/"
cp package.json "$TARGET_DIR/"
cp package-lock.json "$TARGET_DIR/"
cp .env.example "$TARGET_DIR/.env.example"

# Step 4: Create required directories
echo "Creating archive directories..."
mkdir -p "$TARGET_DIR/research-archive"
mkdir -p "$TARGET_DIR/url-content-archive"

# Step 5: Install production dependencies in target directory
echo "Installing production dependencies..."
cd "$TARGET_DIR"
npm install --production --no-audit --no-fund

# Step 6: Create startup script
echo "Creating startup script..."
cat > "$TARGET_DIR/start.sh" << 'EOF'
#!/bin/bash
set -e

# Check if .env file exists, if not, create from example
if [ ! -f .env ]; then
  echo "No .env file found. Creating from .env.example..."
  cp .env.example .env
  echo "Please edit .env file to configure your API keys and settings."
  echo "Then run this script again."
  exit 1
fi

# Start the server
echo "Starting Research MCP Server..."
node dist/index.js
EOF

chmod +x "$TARGET_DIR/start.sh"

# Step 7: Create README
echo "Creating README..."
cat > "$TARGET_DIR/README.md" << 'EOF'
# Standalone Research MCP Server

This is a standalone version of the Research MCP Server that can be deployed independently.

## Getting Started

1. Configure your environment variables:
   ```
   cp .env.example .env
   ```
   Edit the `.env` file to add your API keys and customize settings.

2. Start the server:
   ```
   ./start.sh
   ```
   or
   ```
   node dist/index.js
   ```

3. The server will be available at:
   - SSE endpoint: http://localhost:3100/mcp-sse (or the port you configured)

## Features

- Web search and research reports using Perplexity API
- URL content capture and conversion to Markdown
- Automatic citation archiving
- Research archiving

## Directory Structure

- `dist/` - Compiled JavaScript code
- `node_modules/` - Dependencies
- `research-archive/` - Archive of research reports
- `url-content-archive/` - Archive of captured URL content
- `.env` - Configuration file
- `start.sh` - Startup script

EOF

echo "Done! Standalone Research MCP Server is ready at $TARGET_DIR"
echo "To start the server, run: cd $TARGET_DIR && ./start.sh"
