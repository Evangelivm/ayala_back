#!/bin/bash

#==============================================================================
# SCRIPT: Flink SQL Client
#==============================================================================
# Archivo: sql-client.sh
# Propósito: Abrir el cliente SQL de Flink para ejecutar queries
# Uso: ./scripts/sql-client.sh
#==============================================================================

echo "=========================================="
echo "  Abriendo Flink SQL Client"
echo "=========================================="
echo ""
echo "Desde aquí puedes:"
echo "  - Conectar a tu base de datos MySQL (Prisma)"
echo "  - Ejecutar queries SQL en tiempo real"
echo "  - Procesar streams de Kafka"
echo "  - Crear agregaciones y ventanas de tiempo"
echo ""
echo "Ver ejemplos en: examples/flink-sql-example.sql"
echo ""
echo "=========================================="
echo ""

# Abrir SQL Client de Flink
docker exec -it ayala-flink-jobmanager ./bin/sql-client.sh

echo ""
echo "=========================================="
echo "  SQL Client cerrado"
echo "=========================================="
