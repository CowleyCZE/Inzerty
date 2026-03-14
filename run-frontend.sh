#!/bin/bash
# Udržuje frontend běžící

while true; do
    echo "[$(date)] Start frontendu..." >> /tmp/frontend_monitor.log
    cd /home/cowley/Dokumenty/projekty/Inzerty
    npm run dev >> /tmp/frontend_monitor.log 2>&1
    echo "[$(date)] Frontend ukončen (exit: $?), restart..." >> /tmp/frontend_monitor.log
    sleep 2
done
