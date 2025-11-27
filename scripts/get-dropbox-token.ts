#!/usr/bin/env ts-node

/**
 * Script para obtener el Refresh Token de Dropbox
 *
 * Este script guía al usuario a través del proceso de autenticación OAuth2
 * de Dropbox para obtener un refresh token permanente.
 *
 * Uso:
 * 1. Crea un archivo .env.dropbox con DROPBOX_APP_KEY y DROPBOX_APP_SECRET
 * 2. Ejecuta: npm run get-dropbox-token
 * 3. Sigue las instrucciones en pantalla
 */

import * as dotenv from 'dotenv';
import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';

// Cargar variables de entorno desde .env.dropbox
const envPath = path.resolve(process.cwd(), '.env.dropbox');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Archivo .env.dropbox cargado desde: ${envPath}\n`);
} else {
  console.error(`❌ Error: No se encontró el archivo .env.dropbox en: ${envPath}`);
  console.error(`\nPor favor, crea este archivo con el siguiente contenido:`);
  console.error(`DROPBOX_APP_KEY="tu_app_key"`);
  console.error(`DROPBOX_APP_SECRET="tu_app_secret"`);
  process.exit(1);
}

const APP_KEY = process.env.DROPBOX_APP_KEY;
const APP_SECRET = process.env.DROPBOX_APP_SECRET;

if (!APP_KEY || !APP_SECRET) {
  console.error('❌ Error: DROPBOX_APP_KEY y DROPBOX_APP_SECRET deben estar definidos en .env.dropbox');
  process.exit(1);
}

// Interfaz para leer input del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Función auxiliar para hacer preguntas al usuario
 */
function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Obtiene el refresh token usando el código de autorización
 */
async function getRefreshToken(authCode: string): Promise<string> {
  const tokenUrl = 'https://api.dropboxapi.com/oauth2/token';

  const params = new URLSearchParams({
    code: authCode,
    grant_type: 'authorization_code',
    client_id: APP_KEY!,
    client_secret: APP_SECRET!,
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.refresh_token;
  } catch (error) {
    console.error('❌ Error al obtener el refresh token:', error);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔐 Obtener Refresh Token de Dropbox');
  console.log('═══════════════════════════════════════════════════════\n');

  // URL de autorización
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&token_access_type=offline&response_type=code`;

  console.log('Paso 1: Abre esta URL en tu navegador:\n');
  console.log(authUrl);
  console.log('\nPaso 2: Autoriza la aplicación en Dropbox\n');
  console.log('Paso 3: Dropbox te mostrará un código como este:');
  console.log('        AaBbCcDdEeFfGgHh1234567890\n');
  console.log('Paso 4: Copia ese código y pégalo aquí:\n');

  const authCode = await question('        Código de autorización: ');

  if (!authCode) {
    console.error('\n❌ Error: No se proporcionó ningún código de autorización');
    rl.close();
    process.exit(1);
  }

  console.log('\n⏳ Procesando...\n');

  try {
    const refreshToken = await getRefreshToken(authCode);

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ¡Refresh Token obtenido exitosamente!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`DROPBOX_REFRESH_TOKEN="${refreshToken}"\n`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 GUARDA ESTE TOKEN DE FORMA SEGURA');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('Este token:');
    console.log('✓ NUNCA expira');
    console.log('✓ Es permanente');
    console.log('✓ Lo usarás en tu .env');
    console.log('✓ Guárdalo como guardas tus otras contraseñas\n');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('Próximos pasos:\n');
    console.log('1. Copia el token de arriba');
    console.log('2. Agrégalo a tu archivo .env junto con:');
    console.log(`   DROPBOX_APP_KEY="${APP_KEY}"`);
    console.log(`   DROPBOX_APP_SECRET="${APP_SECRET}"`);
    console.log(`   DROPBOX_REFRESH_TOKEN="${refreshToken}"`);
    console.log('3. Reinicia tu aplicación\n');
    console.log('═══════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Error al obtener el refresh token');
    console.error('Verifica que:');
    console.error('1. El código de autorización sea correcto');
    console.error('2. No haya expirado (tiene validez de 10 minutos)');
    console.error('3. Tu APP_KEY y APP_SECRET sean correctos');
    console.error('4. Tengas conexión a internet\n');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Ejecutar el script
main().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
