#!/bin/bash

#==============================================================================
# SCRIPT DE INICIO - FLINK STACK
#==============================================================================
# Archivo: start.sh
# Propósito: Iniciar todos los servicios de Flink
# Uso: ./scripts/start.sh
#==============================================================================

set -e

echo "=========================================="
echo "  Iniciando Flink Stack - Sistema Ayala"
echo "=========================================="
echo ""

# Verificar que docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está corriendo"
    echo "   Inicia Docker y vuelve a intentar"
    exit 1
fi

echo "✓ Docker está corriendo"
echo ""

# Verificar que docker-compose existe
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose no está instalado"
    exit 1
fi

echo "✓ docker-compose encontrado"
echo ""

# Crear red si no existe
echo "→ Verificando red ayala-network..."
if ! docker network ls | grep -q ayala-network; then
    echo "  Creando red ayala-network..."
    docker network create ayala-network
    echo "  ✓ Red creada"
else
    echo "  ✓ Red ya existe"
fi
echo ""

# Crear directorios necesarios
echo "→ Verificando directorios..."
mkdir -p checkpoints
mkdir -p jobs
mkdir -p config
echo "  ✓ Directorios verificados"
echo ""

# Levantar servicios
echo "→ Iniciando servicios..."
echo ""
docker-compose up -d

echo ""
echo "=========================================="
echo "  Servicios iniciados exitosamente"
echo "=========================================="
echo ""

# Esperar a que los servicios estén listos
echo "→ Esperando a que los servicios estén listos..."
sleep 10

# Verificar estado
echo ""
echo "Estado de los servicios:"
echo ""
docker-compose ps

echo ""
echo "=========================================="
echo "  URLs de acceso:"
echo "=========================================="
echo ""
echo "  Flink Web UI:       http://localhost:8081"
echo "  Elasticsearch API:  http://localhost:9200"
echo "  Kibana UI:          http://localhost:5601"
echo ""
echo "=========================================="
echo "  Comandos útiles:"
echo "=========================================="
echo ""
echo "  Ver logs:           docker-compose logs -f"
echo "  Detener servicios:  docker-compose down"
echo "  Reiniciar:          docker-compose restart"
echo "  Ver estado:         docker-compose ps"
echo ""
echo "=========================================="
