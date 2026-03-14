#!/bin/bash
# Kompletní spuštění všech serverů pro Inzerty aplikaci

echo "=========================================="
echo "🚀 SPUŠTĚNÍ VŠECH SERVERŮ"
echo "=========================================="
echo ""

# 1. Ukončení starých procesů
echo "=== 1. UKONČENÍ STARÝCH PROCESŮ ==="
pkill -9 -f "tsx" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "ollama" 2>/dev/null || true
sleep 2
echo "✅ Staré procesy ukončeny"
echo ""

# 2. Start Ollama
echo "=== 2. SPUŠTĚNÍ OLLAMA AI ==="
nohup ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!
sleep 5
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama běží (PID: $OLLAMA_PID)"
    echo "   URL: http://localhost:11434"
    curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | head -3 | sed 's/"name":"/   Model: /;s/"$//'
else
    echo "❌ Ollama selhala"
fi
echo ""

# 3. Start Backendu (STABILNÍ ZPŮSOB)
echo "=== 3. SPUŠTĚNÍ BACKENDU (STABILNÍ) ==="
cd /home/cowley/Dokumenty/projekty/Inzerty/backend
export NODE_OPTIONS="--max-old-space-size=4096"
nohup npx tsx src/index.ts > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
sleep 10

if curl -s http://localhost:3001/ollama/status | grep -q "status"; then
    echo "✅ Backend běží"
    echo "   URL: http://localhost:3001"
    echo "   WebSocket: ws://localhost:3002"
    curl -s http://localhost:3001/ollama/status
else
    echo "⚠️  Backend možná ještě startuje..."
fi
echo ""

# 4. Start Frontendu
echo "=== 4. SPUŠTĚNÍ FRONTENDU ==="
cd /home/cowley/Dokumenty/projekty/Inzerty
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
sleep 10

if curl -s http://localhost:5173 | grep -q "html"; then
    echo "✅ Frontend běží"
    echo "   URL: http://localhost:5173"
else
    echo "⚠️  Frontend možná ještě startuje..."
fi
echo ""

echo "=========================================="
echo "📊 STATUS"
echo "=========================================="
echo ""
echo "Servery:"
echo "  Ollama:    $OLLAMA_PID"
echo "  Backend:   $BACKEND_PID"
echo "  Frontend:  $FRONTEND_PID"
echo ""
echo "URL:"
echo "  🌐 Frontend:  http://localhost:5173"
echo "  🔧 Backend:   http://localhost:3001"
echo "  💾 WebSocket: ws://localhost:3002"
echo "  🤖 Ollama:    http://localhost:11434"
echo ""
echo "=========================================="
echo "📝 Logy:"
echo "  tail -f /tmp/backend.log"
echo "  tail -f /tmp/frontend.log"
echo "  tail -f /tmp/ollama.log"
echo ""
echo "🛑 Zastavení:"
echo "  pkill -f 'tsx|vite|ollama'"
echo "=========================================="
