import { Injectable, ServiceUnavailableException } from '@nestjs/common';

interface OcrLine {
  text: string;
  confidence: number;
  box: number[][];
}

interface OcrResponse {
  lines: OcrLine[];
  text: string;
}

export interface CamposRecibo {
  ruc: string | null;
  tipoComprobante: 'FACTURA' | 'BOLETA' | 'TICKET' | 'NOTA_VENTA' | null;
  serie: string | null;
  correlativo: string | null;
  fecha: string | null;
  moneda: 'PEN' | 'USD' | null;
  subtotal: number | null;
  igv: number | null;
  total: number | null;
}

export interface ReciboOcrResult {
  texto: string;
  lines: OcrLine[];
  campos: CamposRecibo;
}

// Patrones pensados para boletas/facturas/tickets peruanos, que es el tipo de
// recibo que maneja Ayala (RUC de 11 dígitos, serie-correlativo tipo B001-123,
// moneda S/ o US$).
const RUC_REGEX = /\bRUC[:\s]*?(\d{11})\b/i;
const RUC_STANDALONE_REGEX = /\b(1[0257]\d{9}|20\d{9})\b/;
const SERIE_CORRELATIVO_REGEX = /\b([A-Z]{1,4}\d{0,3})[\s-]+(\d{1,8})\b/;
const FECHA_REGEX = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;
const MONTO_REGEX = /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/;

function parseMonto(raw: string): number {
  // Normaliza "1,234.56" o "1.234,56" a número JS.
  const limpio = raw.replace(/\s/g, '');
  const ultimoPunto = limpio.lastIndexOf('.');
  const ultimaComa = limpio.lastIndexOf(',');
  const separadorDecimal = ultimoPunto > ultimaComa ? '.' : ',';
  const separadorMiles = separadorDecimal === '.' ? ',' : '.';
  const normalizado = limpio
    .split(separadorMiles)
    .join('')
    .replace(separadorDecimal, '.');
  return parseFloat(normalizado);
}

function extraerMontoDeLinea(linea: string): number | null {
  const match = linea.match(MONTO_REGEX);
  return match ? parseMonto(match[1]) : null;
}

@Injectable()
export class ReciboOcrService {
  private readonly ocrServiceUrl: string;

  constructor() {
    this.ocrServiceUrl =
      process.env.OCR_SERVICE_URL?.replace(/\/$/, '') ||
      'http://localhost:8866';
  }

  async extraerDeImagen(file: Express.Multer.File): Promise<ReciboOcrResult> {
    const ocrResponse = await this.llamarServicioOcr(file);
    const campos = this.extraerCampos(ocrResponse);

    return {
      texto: ocrResponse.text,
      lines: ocrResponse.lines,
      campos,
    };
  }

  private async llamarServicioOcr(
    file: Express.Multer.File,
  ): Promise<OcrResponse> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([file.buffer], { type: file.mimetype }),
      file.originalname,
    );

    let response: Response;
    try {
      response = await fetch(`${this.ocrServiceUrl}/ocr`, {
        method: 'POST',
        body: form,
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        `No se pudo conectar con el servicio de OCR (${this.ocrServiceUrl}): ${error.message}`,
      );
    }

    if (!response.ok) {
      const detalle = await response.text().catch(() => response.statusText);
      throw new ServiceUnavailableException(
        `El servicio de OCR respondió con error: ${detalle}`,
      );
    }

    return response.json() as Promise<OcrResponse>;
  }

  private extraerCampos(ocr: OcrResponse): CamposRecibo {
    const lineas = ocr.lines.map((l) => l.text);
    const textoCompleto = ocr.text;
    const textoUpper = textoCompleto.toUpperCase();

    return {
      ruc: this.extraerRuc(textoCompleto),
      tipoComprobante: this.extraerTipoComprobante(textoUpper),
      ...this.extraerSerieCorrelativo(lineas),
      fecha: this.extraerFecha(textoCompleto),
      moneda: this.extraerMoneda(textoCompleto),
      subtotal: this.extraerMontoPorEtiqueta(lineas, [
        'OP. GRAVADA',
        'OPERACION GRAVADA',
        'SUBTOTAL',
        'SUB TOTAL',
      ]),
      igv: this.extraerMontoPorEtiqueta(lineas, ['IGV']),
      total: this.extraerMontoPorEtiqueta(lineas, [
        'IMPORTE TOTAL',
        'TOTAL A PAGAR',
        'TOTAL',
      ]),
    };
  }

  private extraerRuc(texto: string): string | null {
    const conEtiqueta = texto.match(RUC_REGEX);
    if (conEtiqueta) return conEtiqueta[1];

    const sinEtiqueta = texto.match(RUC_STANDALONE_REGEX);
    return sinEtiqueta ? sinEtiqueta[1] : null;
  }

  private extraerTipoComprobante(
    textoUpper: string,
  ): CamposRecibo['tipoComprobante'] {
    if (textoUpper.includes('FACTURA')) return 'FACTURA';
    if (textoUpper.includes('BOLETA')) return 'BOLETA';
    if (textoUpper.includes('NOTA DE VENTA')) return 'NOTA_VENTA';
    if (textoUpper.includes('TICKET')) return 'TICKET';
    return null;
  }

  private extraerSerieCorrelativo(lineas: string[]): {
    serie: string | null;
    correlativo: string | null;
  } {
    for (const linea of lineas) {
      const match = linea.match(SERIE_CORRELATIVO_REGEX);
      if (match) {
        return { serie: match[1], correlativo: match[2] };
      }
    }
    return { serie: null, correlativo: null };
  }

  private extraerFecha(texto: string): string | null {
    const match = texto.match(FECHA_REGEX);
    return match ? match[1] : null;
  }

  private extraerMoneda(texto: string): CamposRecibo['moneda'] {
    if (/US\$|USD|D[OÓ]LAR/i.test(texto)) return 'USD';
    if (/S\/\.?/.test(texto)) return 'PEN';
    return null;
  }

  private extraerMontoPorEtiqueta(
    lineas: string[],
    etiquetas: string[],
  ): number | null {
    for (const etiqueta of etiquetas) {
      const idx = lineas.findIndex((l) => {
        const lineaUpper = l.toUpperCase();
        if (!lineaUpper.includes(etiqueta)) return false;
        // "TOTAL" es substring de "SUBTOTAL"/"SUB TOTAL": evitar que una
        // búsqueda de TOTAL general capture la línea de subtotal.
        if (etiqueta === 'TOTAL' && /SUB\s*TOTAL/.test(lineaUpper)) {
          return false;
        }
        return true;
      });
      if (idx === -1) continue;

      // El monto suele estar en la misma línea que la etiqueta; si el OCR
      // partió la boleta en columnas, puede caer en la línea siguiente.
      const enMismaLinea = extraerMontoDeLinea(lineas[idx]);
      if (enMismaLinea !== null) return enMismaLinea;

      if (idx + 1 < lineas.length) {
        const enSiguienteLinea = extraerMontoDeLinea(lineas[idx + 1]);
        if (enSiguienteLinea !== null) return enSiguienteLinea;
      }
    }
    return null;
  }
}
