# Kafka Setup

## Configuración
- **Kafka**: Puerto 9092
- **Kafka UI**: Puerto 8081
- **Modo**: KRaft (sin Zookeeper)
- **Particiones por defecto**: 6
- **Retention**: 7 días
- **Auto-creación de topics**: Habilitada

## Comandos

### Iniciar servicios
```bash
docker-compose up -d
```

### Ver logs
```bash
docker-compose logs -f kafka
docker-compose logs -f kafka-ui
```

### Parar servicios
```bash
docker-compose down
```

### Limpiar datos (resetear Kafka)
```bash
docker-compose down -v
```

## Acceso
- **Kafka UI**: http://localhost:8081
- **Kafka Broker**: localhost:9092

## Verificar funcionamiento
```bash
# Crear un topic de prueba
docker exec -it kafka kafka-topics --create --topic test-topic --bootstrap-server localhost:9092

# Listar topics
docker exec -it kafka kafka-topics --list --bootstrap-server localhost:9092

# Producir mensajes
docker exec -it kafka kafka-console-producer --topic test-topic --bootstrap-server localhost:9092

# Consumir mensajes
docker exec -it kafka kafka-console-consumer --topic test-topic --from-beginning --bootstrap-server localhost:9092
```