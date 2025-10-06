# Tests para Sistema GRE Kafka

Este archivo contiene tests completos para probar el sistema de Guías de Remisión Electrónicas (GRE) con Kafka **sin conexión a base de datos**.

## 📋 Qué se prueba

### 1. Validaciones de Datos GRE
- ✅ Validación de formato RUC (11 dígitos)
- ✅ Validación de formato DNI conductor (8 dígitos)
- ✅ Validación de códigos UBIGEO (6 dígitos)
- ✅ Validación de campos obligatorios de transporte
- ✅ Validación de estructura completa según plan

### 2. Flujo de Topics Kafka
- ✅ Envío a topic `gre-requests`
- ✅ Procesamiento en topic `gre-processing`
- ✅ Respuestas en topic `gre-responses`
- ✅ Manejo de errores en topic `gre-failed`

### 3. Máquina de Estados GRE
- ✅ Transición: `PENDIENTE` → `PROCESANDO`
- ✅ Transición: `PROCESANDO` → `COMPLETADO`
- ✅ Transición: Cualquier estado → `FALLADO`

### 4. Simulación de Polling Persistente
- ✅ Polling hasta obtener URLs completas
- ✅ Manejo de timeout después de max intentos
- ✅ Simulación de disponibilidad progresiva de URLs

### 5. Mock de API NUBEFACT
- ✅ Simulación de `generar_guia`
- ✅ Simulación de `consultar_guia` con URLs nulos inicialmente
- ✅ Simulación de disponibilidad posterior de URLs

## 🚀 Cómo ejecutar los tests

### Opción 1: Script automatizado
```bash
node test-gre-kafka.js
```

### Opción 2: Jest directo
```bash
npm test src/gre/gre-kafka.spec.ts
```

### Opción 3: Jest con watch mode
```bash
npm run test:watch -- src/gre/gre-kafka.spec.ts
```

## 🔧 Configuración

### Variables de entorno automáticas:
- `NODE_ENV=test`
- `DATABASE_URL=mock://localhost:5432/test`
- `KAFKA_BROKER=mock://localhost:9092`

### Mocks incluidos:
- **KafkaService**: Mock completo del cliente Kafka
- **NubefactApiMock**: Simulación de respuestas de NUBEFACT
- **PollingServiceSimulator**: Simulación de polling persistente
- **GreStatusMachine**: Validación de transiciones de estado

## 📊 Estructura del Test

```
gre-kafka.spec.ts
├── GRE Request Validation      # Validaciones de datos de entrada
├── Kafka Topics Flow          # Flujo de mensajes entre topics
├── GRE Status State Machine   # Transiciones de estados
├── Polling Service Simulation # Simulación de polling persistente
└── NUBEFACT API Integration   # Mock de API externa
```

## 📝 Casos de Test Específicos

### Validaciones que fallan (esperado):
- RUC con menos de 11 dígitos
- UBIGEO con formato incorrecto
- Campos obligatorios vacíos

### Flujos que funcionan:
- Envío completo a todos los topics
- Transiciones de estado válidas
- Polling hasta obtener URLs
- Respuestas exitosas de NUBEFACT

## 🎯 Beneficios de estos tests

1. **Sin dependencias externas**: No requiere Kafka real ni base de datos
2. **Rápida ejecución**: Tests unitarios que corren en milisegundos
3. **Cobertura completa**: Prueba todo el flujo según el plan de implementación
4. **Fácil debugging**: Mocks simples de entender y modificar
5. **CI/CD friendly**: Puede ejecutarse en cualquier pipeline de CI/CD

## 🔍 Cómo interpretar los resultados

### ✅ Tests que deben pasar:
- Validación de datos correctos
- Envío de mensajes a topics
- Transiciones de estado válidas
- Polling exitoso con URLs completas

### ❌ Tests que deben fallar (validación):
- Datos inválidos (RUC, UBIGEO, etc.)
- Transiciones de estado inválidas
- Timeout en polling

## 📋 Checklist de implementación

Usa estos tests para validar que tu implementación real cumple con:

- [ ] Validaciones de datos según plan
- [ ] Configuración correcta de topics Kafka
- [ ] Manejo de estados en base de datos
- [ ] Polling persistente a NUBEFACT
- [ ] Almacenamiento de URLs en campos correctos
- [ ] Manejo de errores y reintentos

## 🚨 Notas importantes

- **No tocar base de datos**: Estos tests son 100% unitarios
- **Mock completo**: Simula toda la infraestructura externa
- **Basado en el plan**: Implementa exactamente lo especificado en `plan_implementacion_gre_kafka.txt`
- **Fácil mantenimiento**: Modifica los mocks según evolucione el plan

## 🔄 Próximos pasos

1. Ejecuta estos tests para entender el flujo completo
2. Implementa los servicios reales siguiendo el plan
3. Usa estos tests como referencia de comportamiento esperado
4. Agrega tests de integración cuando tengas servicios reales