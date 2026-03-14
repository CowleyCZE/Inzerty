#!/bin/bash
# Udržuje backend běžící

while true; do
    echo "[$(date)] Start backendu..." >> /tmp/backend_monitor.log
    cd /home/cowley/Dokumenty/projekty/Inzerty/backend
    export NODE_OPTIONS="--max-old-space-size=4096"
    npx tsx src/index.ts >> /tmp/backend_monitor.log 2>&1
    echo "[$(date)] Backend ukončen (exit: $?), restart..." >> /tmp/backend_monitor.log
    sleep 2
done
