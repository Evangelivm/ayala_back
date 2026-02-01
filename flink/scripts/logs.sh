#!/bin/bash

#==============================================================================
# SCRIPT DE LOGS - FLINK STACK
#==============================================================================
# Archivo: logs.sh
# Propósito: Ver logs de los servicios
# Uso: ./scripts/logs.sh [servicio]
#==============================================================================

SERVICE=${1:-""}

if [ -z "$SERVICE" ]; then
    echo "=========================================="
    echo "  Logs de todos los servicios"
    echo "=========================================="
    echo ""
    docker-compose logs -f --tail=100
else
    echo "=========================================="
    echo "  Logs de: $SERVICE"
    echo "=========================================="
    echo ""
    docker-compose logs -f --tail=100 "$SERVICE"
fi
