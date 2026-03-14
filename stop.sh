#!/bin/bash

# =============================================================================
# Inzerty - Zastavení všech služeb
# =============================================================================
# Tento skript zastaví všechny běžící servery aplikace:
# - Frontend (Vite dev server na portu 5173)
# - Backend (Node.js server na portu 3001)
# - Ollama (AI server na portu 11434)
# =============================================================================

set -e

echo "🛑 Zastavuji všechny servery aplikace Inzerty..."
echo ""

# Barvy pro výstup
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funkce pro zastavení procesu na portu
stop_port() {
    local port=$1
    local name=$2
    
    # Najdeme PID procesu na daném portu
    local pid=$(lsof -t -i:$port 2>/dev/null || true)
    
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}⏹️  Zastavuji $name (port $port, PID: $pid)...${NC}"
        kill $pid 2>/dev/null || true
        
        # Počkáme na graceful shutdown
        sleep 1
        
        # Pokud stále běží, použijeme SIGKILL
        if kill -0 $pid 2>/dev/null; then
            echo -e "${YELLOW}⚠️  $name neodpovídá, posílám SIGKILL...${NC}"
            kill -9 $pid 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✅ $name zastaven${NC}"
    else
        echo -e "${YELLOW}⚪ $name neběží${NC}"
    fi
}

# Funkce pro zastavení procesu podle jména
stop_process() {
    local pattern=$1
    local name=$2
    
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}⏹️  Zastavuji $name...${NC}"
        for pid in $pids; do
            kill $pid 2>/dev/null || true
        done
        
        sleep 1
        
        # Pokud stále běží, použijeme SIGKILL
        for pid in $pids; do
            if kill -0 $pid 2>/dev/null; then
                kill -9 $pid 2>/dev/null || true
            fi
        done
        
        echo -e "${GREEN}✅ $name zastaven${NC}"
    else
        echo -e "${YELLOW}⚪ $name neběží${NC}"
    fi
}

echo "=========================================="
echo "📋 Kontrola běžících služeb"
echo "=========================================="
echo ""

# 1. Zastavení Frontendu (port 5173)
stop_port 5173 "Frontend (Vite)"

echo ""

# 2. Zastavení Backendu (port 3001)
stop_port 3001 "Backend (Node.js)"

echo ""

# 3. Zastavení Ollama (port 11434)
stop_port 11434 "Ollama"

# Také zkusíme najít proces ollama podle jména
stop_process "ollama serve" "Ollama (serve)"

echo ""
echo "=========================================="
echo "📊 Výsledek"
echo "=========================================="
echo ""

# Kontrola, zda něco stále běží
remaining_frontend=$(lsof -t -i:5173 2>/dev/null || true)
remaining_backend=$(lsof -t -i:3001 2>/dev/null || true)
remaining_ollama=$(lsof -t -i:11434 2>/dev/null || true)

if [ -z "$remaining_frontend" ] && [ -z "$remaining_backend" ] && [ -z "$remaining_ollama" ]; then
    echo -e "${GREEN}✅ Všechny servery byly úspěšně zastaveny!${NC}"
else
    echo -e "${RED}⚠️  Některé servery stále běží:${NC}"
    [ -n "$remaining_frontend" ] && echo -e "${RED}   - Frontend (PID: $remaining_frontend)${NC}"
    [ -n "$remaining_backend" ] && echo -e "${RED}   - Backend (PID: $remaining_backend)${NC}"
    [ -n "$remaining_ollama" ] && echo -e "${RED}   - Ollama (PID: $remaining_ollama)${NC}"
    echo ""
    echo -e "${YELLOW}💡 Pro ruční zastavení použijte: kill -9 <PID>${NC}"
fi

echo ""
echo "=========================================="
echo "👋 Hotovo!"
echo "=========================================="
