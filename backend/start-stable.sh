#!/bin/bash
# Stabilní spuštění backendu s automatickým restartem při pádu

LOG_FILE="/tmp/backend_stable.log"
MAX_RESTARTS=5
RESTART_COUNT=0

echo "🚀 Spouštím backend stabilním způsobem..."
echo "Log: $LOG_FILE"

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Start backendu (pokus $((RESTART_COUNT + 1)))" >> $LOG_FILE
    
    export NODE_OPTIONS="--max-old-space-size=4096"
    cd /home/cowley/Dokumenty/projekty/Inzerty/backend
    
    # Spustíme backend a čekáme na jeho ukončení
    npx tsx src/index.ts >> $LOG_FILE 2>&1
    EXIT_CODE=$?
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend ukončen s kódem $EXIT_CODE" >> $LOG_FILE
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ Backend ukončen normálně"
        break
    else
        RESTART_COUNT=$((RESTART_COUNT + 1))
        echo "⚠️  Backend spadl! Restart za 3s... ($RESTART_COUNT/$MAX_RESTARTS)"
        sleep 3
    fi
done

if [ $RESTART_COUNT -ge $MAX_RESTARTS ]; then
    echo "❌ Backend dosáhl maximálního počtu restartů ($MAX_RESTARTS)"
    echo "Zkontroluj log: $LOG_FILE"
    exit 1
fi
