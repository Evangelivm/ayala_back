import { Prisma } from '@generated/prisma-third/client';

// Sirve tanto el PrismaThirdService como un cliente de transacción
type Db = Pick<Prisma.TransactionClient, 'grupos_multifactura'>;

/** MF-000045: código legible de un grupo de multifactura */
export function formatearCodigoGrupo(nro: number): string {
  return `MF-${String(nro).padStart(6, '0')}`;
}

/**
 * Garantiza que el grupo tenga código (lo crea si no existe) y lo devuelve.
 * Se llama dentro de la misma transacción que crea o agrupa las órdenes.
 */
export async function asegurarCodigoGrupo(
  db: Db,
  grupoId: string,
): Promise<string> {
  const fila = await db.grupos_multifactura.upsert({
    where: { grupo_id: grupoId },
    create: { grupo_id: grupoId },
    update: {},
  });
  return formatearCodigoGrupo(fila.nro);
}

/**
 * Códigos de varios grupos (grupo_id → 'MF-000045'). Un grupo que aún no tenga
 * código (p. ej. creado antes de la migración) lo recibe en este momento.
 */
export async function obtenerCodigosGrupos(
  db: Db,
  grupoIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set(grupoIds.filter((g): g is string => !!g))];
  const mapa = new Map<string, string>();
  if (ids.length === 0) return mapa;

  const filas = await db.grupos_multifactura.findMany({
    where: { grupo_id: { in: ids } },
  });
  for (const f of filas) mapa.set(f.grupo_id, formatearCodigoGrupo(f.nro));

  for (const id of ids) {
    if (!mapa.has(id)) mapa.set(id, await asegurarCodigoGrupo(db, id));
  }
  return mapa;
}

/** Agrega `grupo_codigo` a cada orden que pertenezca a un grupo */
export async function conCodigoGrupo<T extends { grupo_id?: string | null }>(
  db: Db,
  ordenes: T[],
): Promise<Array<T & { grupo_codigo: string | null }>> {
  const codigos = await obtenerCodigosGrupos(
    db,
    ordenes.map((o) => o.grupo_id),
  );
  return ordenes.map((o) => ({
    ...o,
    grupo_codigo: o.grupo_id ? (codigos.get(o.grupo_id) ?? null) : null,
  }));
}
