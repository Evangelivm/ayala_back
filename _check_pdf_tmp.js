const { PrismaClient } = require('./generated/prisma-third');
const prisma = new PrismaClient();

(async () => {
  const compras = await prisma.ordenes_compra.findMany({
    orderBy: { id_orden_compra: 'desc' },
    take: 5,
    select: {
      id_orden_compra: true,
      numero_orden: true,
      formato_pdf_version: true,
      id_camion: true,
      detalles_orden_compra: {
        select: { id_detalle: true, id_camion: true },
      },
    },
  });
  console.log('COMPRAS:', JSON.stringify(compras, null, 2));

  const servicios = await prisma.ordenes_servicio.findMany({
    orderBy: { id_orden_servicio: 'desc' },
    take: 5,
    select: {
      id_orden_servicio: true,
      numero_orden: true,
      formato_pdf_version: true,
      id_camion: true,
      detalles_orden_servicio: {
        select: { id_detalle: true, id_camion: true },
      },
    },
  });
  console.log('SERVICIOS:', JSON.stringify(servicios, null, 2));

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
