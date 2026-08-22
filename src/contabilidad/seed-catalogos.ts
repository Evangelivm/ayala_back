// Siembra las tablas cat_* de contabilidad con los valores de la hoja
// "TABLAS" del Excel original (ver contabilidad.catalogos.ts). Idempotente:
// usa upsert, así que se puede correr varias veces sin duplicar filas.
//
// Uso: npx ts-node -r tsconfig-paths/register src/contabilidad/seed-catalogos.ts
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@generated/prisma-third/client';
import { CATALOGOS_SEED } from './contabilidad.catalogos';

async function sembrarTabla(
  nombre: string,
  upsertFila: (fila: {
    codigo: string;
    descripcion: string;
  }) => Promise<unknown>,
  filas: { codigo: string; descripcion: string }[],
) {
  for (const fila of filas) {
    await upsertFila(fila);
  }
  console.log(`✔ ${nombre}: ${filas.length} filas sembradas`);
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(process.env.DATABASE_URL_THIRD!),
  });

  try {
    await sembrarTabla(
      'cat_modulo',
      (fila) =>
        prisma.cat_modulo.upsert({
          where: { codigo: fila.codigo },
          create: fila,
          update: { descripcion: fila.descripcion },
        }),
      CATALOGOS_SEED.cat_modulo,
    );
    await sembrarTabla(
      'cat_fuente',
      (fila) =>
        prisma.cat_fuente.upsert({
          where: { codigo: fila.codigo },
          create: fila,
          update: { descripcion: fila.descripcion },
        }),
      CATALOGOS_SEED.cat_fuente,
    );
    await sembrarTabla(
      'cat_moneda',
      (fila) =>
        prisma.cat_moneda.upsert({
          where: { codigo: fila.codigo },
          create: fila,
          update: { descripcion: fila.descripcion },
        }),
      CATALOGOS_SEED.cat_moneda,
    );
    await sembrarTabla(
      'cat_tipo_doc_identidad',
      (fila) =>
        prisma.cat_tipo_doc_identidad.upsert({
          where: { codigo: fila.codigo },
          create: fila,
          update: { descripcion: fila.descripcion },
        }),
      CATALOGOS_SEED.cat_tipo_doc_identidad,
    );
    await sembrarTabla(
      'cat_forma_pago',
      (fila) =>
        prisma.cat_forma_pago.upsert({
          where: { codigo: fila.codigo },
          create: fila,
          update: { descripcion: fila.descripcion },
        }),
      CATALOGOS_SEED.cat_forma_pago,
    );
    await sembrarTabla(
      'cat_medio_pago',
      (fila) =>
        prisma.cat_medio_pago.upsert({
          where: { codigo: fila.codigo },
          create: fila,
          update: { descripcion: fila.descripcion },
        }),
      CATALOGOS_SEED.cat_medio_pago,
    );
    await sembrarTabla(
      'cat_indicador_afecto',
      (fila) =>
        prisma.cat_indicador_afecto.upsert({
          where: { codigo: fila.codigo },
          create: fila,
          update: { descripcion: fila.descripcion },
        }),
      CATALOGOS_SEED.cat_indicador_afecto,
    );
    await sembrarTabla(
      'cat_concepto_flujo_efectivo',
      (fila) =>
        prisma.cat_concepto_flujo_efectivo.upsert({
          where: { codigo: fila.codigo },
          create: fila,
          update: { descripcion: fila.descripcion },
        }),
      CATALOGOS_SEED.cat_concepto_flujo_efectivo,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Error sembrando catálogos de contabilidad:', error);
  process.exit(1);
});
