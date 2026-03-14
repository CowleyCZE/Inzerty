#!/bin/bash
# Spustí backend ve screen aby běžel stabilně

# Zabití starého backendu
screen -S backend -X quit 2>/dev/null
sleep 1

# Nový backend ve screen
screen -dmS backend bash -c '
    cd /home/cowley/Dokumenty/projekty/Inzerty/backend
    export NODE_OPTIONS="--max-old-space-size=4096"
    echo "Backend spuštěn v $(date)" >> /tmp/backend_screen.log
    npx tsx src/index.ts >> /tmp/backend_screen.log 2>&1
'

echo "Backend spuštěn ve screen"
sleep 5
curl -s http://localhost:3001/ollama/status && echo " ✅ Backend běží" || echo " ❌ Backend selhal"
