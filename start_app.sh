#!/data/data/com.termux/files/usr/bin/bash
PROJECT_DIR="/data/data/com.termux/files/home/projects/Inzerty"
cd "$PROJECT_DIR"

# Start backend
echo "Starting backend..."
(
    cd backend
    node ./node_modules/.bin/tsx watch src/index.ts
) &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend..."
node ./node_modules/.bin/vite

# Cleanup backend on exit
echo "Stopping backend..."
kill $BACKEND_PID 2>/dev/null
