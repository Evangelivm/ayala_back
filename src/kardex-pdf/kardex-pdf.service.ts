import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import type PDFKit from 'pdfkit';
import { Readable } from 'stream';

@Injectable()
export class KardexPdfService {
  async generatePDF(kardexData: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const { kardexLAR, metodoPromedioLAR } = kardexData;

        console.log('=== DEBUG INFO ===');
        console.log('kardexLAR.rows length:', kardexLAR.rows?.length || 0);
        console.log('metodoPromedioLAR.rows length:', metodoPromedioLAR.rows?.length || 0);

        // Crear documento PDF
        const doc = new PDFDocument({
          size: 'LEGAL',
          layout: 'landscape',
          margin: 20,
        });

        const chunks: Buffer[] = [];

        // Capturar el stream en un buffer
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ==================== PÁGINA 1: KARDEX LAR ====================

        // Header
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(kardexLAR.header.empresa, 50, 30, { width: 900, align: 'center' });

        doc.fontSize(9).font('Helvetica');
        let yPos = 50;

        doc.text(`Empresa: ${kardexLAR.header.empresa}`, 50, yPos);
        doc.text(`FECHA: ${kardexLAR.header.fechaKardex}`, 600, yPos);
        yPos += 15;

        doc.text(`Condicion: ${kardexLAR.header.condicion}`, 50, yPos);
        doc.text(`Inicio: ${kardexLAR.header.stockInicial}`, 600, yPos);
        yPos += 15;

        doc.text(`Lugar: ${kardexLAR.header.lugar}`, 50, yPos);
        doc.text(`Stock Actual: ${kardexLAR.header.stockActual}`, 600, yPos);
        yPos += 25;

        // Línea separadora
        doc.moveTo(50, yPos).lineTo(950, yPos).stroke();
        yPos += 10;

        // Tabla Kardex LAR
        const kardexHeaders = [
          { label: 'ITM', width: 30 },
          { label: 'FECHA', width: 60 },
          { label: 'SEM', width: 35 },
          { label: 'CONDICION', width: 70 },
          { label: 'Comprobante', width: 75 },
          { label: 'H/KM', width: 50 },
          { label: 'DETALLE', width: 200 },
          { label: 'TARIFA', width: 50 },
          { label: 'C.INGRESO', width: 65 },
          { label: 'C.SALIDA', width: 65 },
          { label: 'Ingreso', width: 50 },
          { label: 'Salida', width: 50 },
          { label: 'SALDO', width: 60 },
        ];

        yPos = this.drawTableHeader(doc, 50, yPos, kardexHeaders, 18);
        yPos = this.drawKardexRows(doc, 50, yPos, kardexLAR.rows, kardexHeaders, 18);

        // Info de stock
        doc.fontSize(8).font('Helvetica-Bold');
        doc
          .fillColor('#000000')
          .rect(50, yPos + 10, 200, 30)
          .fillAndStroke('#f0f0f0', '#000000');
        doc
          .fillColor('#000000')
          .text(`Cant Galones: ${kardexLAR.header.stockActual}`, 60, yPos + 20);

        // ==================== PÁGINA 2: MÉTODO PROMEDIO ====================
        doc.addPage();

        // Header
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(metodoPromedioLAR.header.empresa, 50, 30, { width: 900, align: 'center' });

        yPos = 50;
        doc.fontSize(9).font('Helvetica');
        doc.text(`Empresa: ${metodoPromedioLAR.header.empresa}`, 50, yPos);
        yPos += 15;
        doc.text(`Condicion: ${metodoPromedioLAR.header.condicion}`, 50, yPos);
        yPos += 15;
        doc.text(`Lugar: ${metodoPromedioLAR.header.lugar}`, 50, yPos);
        yPos += 25;

        // Línea separadora
        doc.moveTo(50, yPos).lineTo(950, yPos).stroke();
        yPos += 10;

        // Tabla Método Promedio
        const metodoHeaders = [
          { label: 'Periodo', width: 45 },
          { label: 'FECHA', width: 60 },
          { label: 'Comprobante', width: 70 },
          { label: 'H/KM', width: 50 },
          { label: 'DETALLE', width: 170 },
          { label: 'Cant', width: 50 },
          { label: 'Cu', width: 50 },
          { label: 'C.Total', width: 55 },
          { label: 'Cant', width: 50 },
          { label: 'Cu', width: 50 },
          { label: 'C.Total', width: 55 },
          { label: 'Cant', width: 50 },
          { label: 'Cu', width: 50 },
          { label: 'C.Total', width: 55 },
        ];

        yPos = this.drawTableHeader(doc, 50, yPos, metodoHeaders, 18);

        // Fila de inventario inicial
        yPos = this.drawInitialInventoryRow(
          doc,
          50,
          yPos,
          metodoPromedioLAR.initialInventory,
          metodoHeaders,
          18,
        );

        // Filas de datos
        yPos = this.drawMetodoPromedioRows(
          doc,
          50,
          yPos,
          metodoPromedioLAR.rows,
          metodoHeaders,
          18,
        );

        // Resumen Final
        const summaryY = yPos + 15;
        doc.fontSize(10).font('Helvetica-Bold');
        doc
          .fillColor('#000000')
          .rect(50, summaryY, 860, 90)
          .fillAndStroke('#f8f9fa', '#000000');

        doc
          .fillColor('#000000')
          .text('Resumen Final', 50, summaryY + 10, { width: 860, align: 'center' });

        const summaryItemWidth = 215;
        let summaryX = 50;
        const summaryItemY = summaryY + 30;

        // Inventario Inicial
        doc
          .rect(summaryX, summaryItemY, summaryItemWidth, 35)
          .fillAndStroke('#ffffff', '#000000');
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#000000')
          .text('Inventario Inicial', summaryX + 5, summaryItemY + 5, {
            width: summaryItemWidth - 10,
            align: 'left',
          });
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#3b82f6')
          .text(
            `$ ${metodoPromedioLAR.summary.inventarioInicial}`,
            summaryX + 5,
            summaryItemY + 18,
            { width: summaryItemWidth - 10, align: 'left' },
          );

        // Compras
        summaryX += summaryItemWidth;
        doc
          .rect(summaryX, summaryItemY, summaryItemWidth, 35)
          .fillAndStroke('#ffffff', '#000000');
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#000000')
          .text('Compras', summaryX + 5, summaryItemY + 5, {
            width: summaryItemWidth - 10,
            align: 'left',
          });
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#22c55e')
          .text(`$ ${metodoPromedioLAR.summary.compras}`, summaryX + 5, summaryItemY + 18, {
            width: summaryItemWidth - 10,
            align: 'left',
          });

        // Costo de Ventas
        summaryX += summaryItemWidth;
        doc
          .rect(summaryX, summaryItemY, summaryItemWidth, 35)
          .fillAndStroke('#ffffff', '#000000');
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#000000')
          .text('Costo de Ventas', summaryX + 5, summaryItemY + 5, {
            width: summaryItemWidth - 10,
            align: 'left',
          });
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#ef4444')
          .text(`$ ${metodoPromedioLAR.summary.costoDeVentas}`, summaryX + 5, summaryItemY + 18, {
            width: summaryItemWidth - 10,
            align: 'left',
          });

        // Inventario Final
        summaryX += summaryItemWidth;
        doc
          .rect(summaryX, summaryItemY, summaryItemWidth, 35)
          .fillAndStroke('#ffffff', '#000000');
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#000000')
          .text('Inventario Final', summaryX + 5, summaryItemY + 5, {
            width: summaryItemWidth - 10,
            align: 'left',
          });
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#a855f7')
          .text(`$ ${metodoPromedioLAR.summary.inventarioFinal}`, summaryX + 5, summaryItemY + 18, {
            width: summaryItemWidth - 10,
            align: 'left',
          });

        // Verificación
        const verificationY = summaryItemY + 45;
        doc
          .rect(50, verificationY, 860, 25)
          .fillAndStroke('#d4edda', '#22c55e');
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#000000')
          .text(
            `Verificación: ${metodoPromedioLAR.summary.inventarioInicial} + ${metodoPromedioLAR.summary.compras} - ${metodoPromedioLAR.summary.costoDeVentas} = ${metodoPromedioLAR.summary.inventarioFinal}`,
            55,
            verificationY + 9,
            { width: 850, align: 'center' },
          );

        // Finalizar el documento
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private drawTableHeader(
    doc: PDFKit.PDFDocument,
    startX: number,
    startY: number,
    headers: { label: string; width: number }[],
    rowHeight: number,
  ): number {
    const totalWidth = headers.reduce((sum, h) => sum + h.width, 0);

    // Dibujar fondo del header
    doc.fillColor('#e0e0e0').rect(startX, startY, totalWidth, rowHeight).fill();

    let currentX = startX;
    headers.forEach((header) => {
      // Dibujar borde de celda
      doc.strokeColor('#000000').rect(currentX, startY, header.width, rowHeight).stroke();

      // Dibujar texto
      doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold');
      const textY = startY + (rowHeight - 7) / 2 + 2;

      doc.text(header.label, currentX, textY, {
        width: header.width,
        align: 'center',
        lineBreak: false,
      });

      currentX += header.width;
    });

    return startY + rowHeight;
  }

  private drawKardexRows(
    doc: PDFKit.PDFDocument,
    startX: number,
    startY: number,
    rows: any[],
    headers: { label: string; width: number }[],
    rowHeight: number,
  ): number {
    let currentY = startY;
    const maxY = 550; // Altura máxima antes de crear nueva página (tamaño LEGAL landscape)

    rows.forEach((row) => {
      // Verificar si necesitamos una nueva página
      if (currentY + rowHeight > maxY) {
        doc.addPage();
        currentY = 50;
        // Redibujar header en la nueva página
        currentY = this.drawTableHeader(doc, startX, currentY, headers, 18);
      }

      const bgColor = row.CONDICION === 'INGRESO' ? '#d4edda' : '#ffffff';
      const totalWidth = headers.reduce((sum, h) => sum + h.width, 0);

      // Dibujar fondo de fila
      doc.fillColor(bgColor).rect(startX, currentY, totalWidth, rowHeight).fill();

      const rowData = [
        row.ITM,
        row.FECHA,
        row.SEM,
        row.CONDICION,
        row['Nª Comprobante'],
        row['H/KM'],
        row.DETALLE,
        row.TARIFA,
        row['COSTO INGRESO'],
        row['COSTO SALIDA'],
        row.Ingreso,
        row.Salida,
        row.SALDO,
      ];

      let currentX = startX;
      headers.forEach((header, index) => {
        // Dibujar borde
        doc.strokeColor('#000000').rect(currentX, currentY, header.width, rowHeight).stroke();

        // Dibujar texto
        doc.fillColor('#000000').fontSize(7).font('Helvetica');
        const cellValue = rowData[index]?.toString() || '';
        const textY = currentY + (rowHeight - 7) / 2 + 2;
        const align = index >= 7 ? 'right' : index === 6 ? 'left' : 'center';

        doc.text(cellValue, currentX + 3, textY, {
          width: header.width - 6,
          align: align as any,
          lineBreak: false,
          ellipsis: true,
        });

        currentX += header.width;
      });

      currentY += rowHeight;
    });

    return currentY;
  }

  private drawInitialInventoryRow(
    doc: PDFKit.PDFDocument,
    startX: number,
    startY: number,
    initialInventory: any,
    headers: { label: string; width: number }[],
    rowHeight: number,
  ): number {
    const totalWidth = headers.reduce((sum, h) => sum + h.width, 0);

    // Dibujar fondo
    doc.fillColor('#fff8dc').rect(startX, startY, totalWidth, rowHeight).fill();

    const rowData = [
      '',
      initialInventory.fecha,
      '',
      '',
      `Inventario Inicial ${initialInventory.fecha}`,
      '',
      '',
      '',
      '',
      '',
      '',
      initialInventory.Cant,
      initialInventory.Cu,
      initialInventory['C.Total'],
    ];

    let currentX = startX;
    headers.forEach((header, index) => {
      // Dibujar borde
      doc.strokeColor('#000000').rect(currentX, startY, header.width, rowHeight).stroke();

      // Dibujar texto
      doc.fillColor('#000000').fontSize(6).font('Helvetica');
      const cellValue = rowData[index]?.toString() || '';
      const textY = startY + (rowHeight - 6) / 2 + 2;
      const align = index >= 5 && index !== 4 ? 'right' : index === 4 ? 'left' : 'center';

      doc.text(cellValue, currentX + 3, textY, {
        width: header.width - 6,
        align: align as any,
        lineBreak: false,
        ellipsis: true,
      });

      currentX += header.width;
    });

    return startY + rowHeight;
  }

  private drawMetodoPromedioRows(
    doc: PDFKit.PDFDocument,
    startX: number,
    startY: number,
    rows: any[],
    headers: { label: string; width: number }[],
    rowHeight: number,
  ): number {
    let currentY = startY;
    const maxY = 480; // Altura máxima antes de crear nueva página (dejando espacio para el resumen)

    rows.forEach((row) => {
      // Verificar si necesitamos una nueva página
      if (currentY + rowHeight > maxY) {
        doc.addPage();
        currentY = 50;
        // Redibujar header en la nueva página
        currentY = this.drawTableHeader(doc, startX, currentY, headers, 18);
      }

      const totalWidth = headers.reduce((sum, h) => sum + h.width, 0);

      // Dibujar fondo de fila
      doc.fillColor('#ffffff').rect(startX, currentY, totalWidth, rowHeight).fill();

      const rowData = [
        row.Periodo,
        row.FECHA,
        row['Nª Comprobante'],
        row['H/KM'],
        row.DETALLE,
        row['Entradas.Cant'],
        row['Entradas.Cu'],
        row['Entradas.C.Total'],
        row['Salidas.Cant'],
        row['Salidas.Cu'],
        row['Salidas.C.Total'],
        row['Saldos.Cant'],
        row['Saldos.Cu'],
        row['Saldos.C.Total'],
      ];

      let currentX = startX;
      headers.forEach((header, index) => {
        // Dibujar borde
        doc.strokeColor('#000000').rect(currentX, currentY, header.width, rowHeight).stroke();

        // Dibujar texto
        doc.fillColor('#000000').fontSize(6).font('Helvetica');
        const cellValue = rowData[index]?.toString() || '';
        const textY = currentY + (rowHeight - 6) / 2 + 2;
        const align = index >= 5 ? 'right' : index === 4 ? 'left' : 'center';

        doc.text(cellValue, currentX + 3, textY, {
          width: header.width - 6,
          align: align as any,
          lineBreak: false,
          ellipsis: true,
        });

        currentX += header.width;
      });

      currentY += rowHeight;
    });

    return currentY;
  }
}
