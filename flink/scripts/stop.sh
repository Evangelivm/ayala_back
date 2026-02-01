#!/bin/bash

#==============================================================================
# SCRIPT DE DETENCIÓN - FLINK STACK
#==============================================================================
# Archivo: stop.sh
# Propósito: Detener todos los servicios de Flink
# Uso: ./scripts/stop.sh
#==============================================================================

set -e

echo "=========================================="
echo "  Deteniendo Flink Stack - Sistema Ayala"
echo "=========================================="
echo ""

# Verificar que docker compose existe
if ! docker compose version &> /dev/null; then
    echo "❌ Error: docker compose no está disponible"
    exit 1
fi

# Detener servicios
echo "→ Deteniendo servicios..."
echo ""
docker compose down

echo ""
echo "=========================================="
echo "  Servicios detenidos exitosamente"
echo "=========================================="
echo ""
echo "  Los datos persisten en:"
echo "  - Checkpoints: ./checkpoints/"
echo "  - Elasticsearch: volume ayala-elasticsearch-data"
echo ""
echo "  Para eliminar todo (incluyendo datos):"
echo "  docker compose down -v"
echo ""
