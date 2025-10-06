#!/usr/bin/env node

/**
 * Script para ejecutar los tests del sistema GRE Kafka
 * sin conectarse a la base de datos real
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Ejecutando tests del sistema GRE Kafka...\n');

try {
  // Verificar que el archivo de test existe
  const testFile = path.join(__dirname, 'src', 'gre', 'gre-kafka.spec.ts');
  if (!fs.existsSync(testFile)) {
    throw new Error(`Archivo de test no encontrado: ${testFile}`);
  }

  console.log('✅ Archivo de test encontrado');
  console.log('📁 Ubicación:', testFile);
  console.log('');

  // Configurar variables de entorno para evitar conexión a BD
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'mock://localhost:5432/test';
  process.env.KAFKA_BROKER = 'mock://localhost:9092';

  console.log('🔧 Variables de entorno configuradas para testing');
  console.log('📊 Ejecutando tests con Jest...\n');

  // Ejecutar el test específico
  const command = `npx jest src/gre/gre-kafka.spec.ts --verbose --detectOpenHandles`;

  console.log(`Comando: ${command}\n`);

  const output = execSync(command, {
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...process.env }
  });

  console.log('\n✅ Tests completados exitosamente!');

} catch (error) {
  console.error('\n❌ Error ejecutando tests:', error.message);

  if (error.stdout) {
    console.log('\nSTDOUT:', error.stdout.toString());
  }

  if (error.stderr) {
    console.error('\nSTDERR:', error.stderr.toString());
  }

  process.exit(1);
}