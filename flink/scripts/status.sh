#!/bin/bash

#==============================================================================
# SCRIPT DE ESTADO - FLINK STACK
#==============================================================================
# Archivo: status.sh
# Propósito: Verificar estado de todos los servicios
# Uso: ./scripts/status.sh
#==============================================================================

echo "=========================================="
echo "  Estado de Servicios - Flink Stack"
echo "=========================================="
echo ""

# Estado de contenedores
echo "→ Contenedores Docker:"
echo ""
docker-compose ps

echo ""
echo "→ Uso de recursos:"
echo ""
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" \
    ayala-flink-jobmanager \
    ayala-flink-taskmanager-1 \
    ayala-flink-taskmanager-2 \
    ayala-elasticsearch \
    ayala-kibana 2>/dev/null || echo "  (servicios no iniciados)"

echo ""
echo "→ Health checks:"
echo ""

# Flink JobManager
if curl -s http://localhost:8081/overview > /dev/null 2>&1; then
    echo "  ✓ Flink JobManager:   ONLINE (http://localhost:8081)"
else
    echo "  ✗ Flink JobManager:   OFFLINE"
fi

# Elasticsearch
if curl -s http://localhost:9200 > /dev/null 2>&1; then
    echo "  ✓ Elasticsearch:      ONLINE (http://localhost:9200)"
else
    echo "  ✗ Elasticsearch:      OFFLINE"
fi

# Kibana
if curl -s http://localhost:5601 > /dev/null 2>&1; then
    echo "  ✓ Kibana:             ONLINE (http://localhost:5601)"
else
    echo "  ✗ Kibana:             OFFLINE"
fi

echo ""
echo "→ Espacio en disco (checkpoints):"
echo ""
du -sh checkpoints/ 2>/dev/null || echo "  0 (no hay checkpoints)"

echo ""
echo "=========================================="
