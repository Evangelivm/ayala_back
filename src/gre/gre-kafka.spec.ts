import { Test, TestingModule } from '@nestjs/testing';
import { ClientKafka } from '@nestjs/microservices';
import { KafkaService, GreRequestMessage, GreResponseMessage } from '../kafka/kafka.service';

describe('GRE Kafka Integration Test (No Database)', () => {
  let kafkaService: KafkaService;
  let mockKafkaClient: jest.Mocked<ClientKafka>;
  let testModule: TestingModule;

  // Mock data basado en el plan de implementación
  const mockGreRequest: GreRequestMessage = {
    id: 'test-uuid-123',
    timestamp: '2025-09-26T10:00:00Z',
    data: {
      operacion: 'generar_guia',
      tipo_de_comprobante: 9,
      serie: 'T001',
      numero: 123,
      sunat_transaction: 1,
      cliente_tipo_de_documento: 6,
      cliente_numero_de_documento: '20123456789',
      cliente_denominacion: 'EMPRESA TEST SAC',
      cliente_direccion: 'AV. TEST 123',
      fecha_de_emision: '26-09-2025',
      moneda: 'PEN',
      porcentaje_de_igv: 18.00,
      total_gravada: 100.00,
      total_igv: 18.00,
      total: 118.00,
      enviar_automaticamente_a_la_sunat: true,
      enviar_automaticamente_al_cliente: false,
      placa_vehiculo: 'ABC-123',
      items: [
        {
          unidad_de_medida: 'NIU',
          codigo: '001',
          descripcion: 'PRODUCTO TEST',
          cantidad: 1,
          valor_unitario: 100.00,
          precio_unitario: 118.00,
          subtotal: 100.00,
          tipo_de_igv: 1,
          igv: 18.00,
          total: 118.00,
          anticipo_regularizacion: false
        }
      ],
      parametros_adicionales: {
        UBIGEO_PARTIDA: '150101',
        DIRECCION_PARTIDA: 'LIMA CENTRO',
        UBIGEO_LLEGADA: '150102',
        DIRECCION_LLEGADA: 'CALLAO CENTRO',
        NUMERO_DOCUMENTO_CONDUCTOR: '12345678',
        TIPO_DOCUMENTO_CONDUCTOR: '1',
        NOMBRES_CONDUCTOR: 'JUAN',
        APELLIDOS_CONDUCTOR: 'PEREZ',
        NUMERO_LICENCIA: 'Q12345678',
        NUMERO_DOCUMENTO_TRANSPORTE: '20123456789',
        TIPO_DOCUMENTO_TRANSPORTE: '6',
        RAZON_SOCIAL_TRANSPORTE: 'TRANSPORTES TEST SAC',
        NUMERO_MTCVC: '123456789'
      }
    }
  };

  const mockNubefactResponse: GreResponseMessage = {
    id: 'test-uuid-123',
    status: 'success',
    nubefact_response: {
      pdf_url: 'https://nubefact.com/pdf/test123.pdf',
      xml_url: 'https://nubefact.com/xml/test123.xml',
      cdr_url: 'https://nubefact.com/cdr/test123.zip'
    },
    error: undefined
  };

  beforeEach(async () => {
    // Mock del cliente Kafka
    mockKafkaClient = {
      emit: jest.fn().mockReturnValue({ toPromise: jest.fn().mockResolvedValue(true) }),
      send: jest.fn().mockReturnValue({ toPromise: jest.fn().mockResolvedValue(mockNubefactResponse) }),
      subscribeToResponseOf: jest.fn(),
      close: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    } as any;

    testModule = await Test.createTestingModule({
      providers: [
        KafkaService,
        {
          provide: 'KAFKA_SERVICE',
          useValue: mockKafkaClient,
        },
      ],
    }).compile();

    kafkaService = testModule.get<KafkaService>(KafkaService);
  });

  afterEach(async () => {
    if (testModule) {
      await testModule.close();
    }
  });

  describe('GRE Request Validation', () => {
    it('should validate required GRE fields according to plan', () => {
      const validation = validateGreRequest(mockGreRequest.data);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid RUC format', () => {
      const invalidRequest = {
        ...mockGreRequest.data,
        cliente_numero_de_documento: '12345' // RUC inválido
      };

      const validation = validateGreRequest(invalidRequest);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('RUC debe tener 11 dígitos');
    });

    it('should reject invalid UBIGEO format', () => {
      const invalidRequest = {
        ...mockGreRequest.data,
        parametros_adicionales: {
          ...mockGreRequest.data.parametros_adicionales,
          UBIGEO_PARTIDA: '123' // UBIGEO inválido
        }
      };

      const validation = validateGreRequest(invalidRequest);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('UBIGEO debe tener 6 dígitos');
    });

    it('should reject missing transport parameters', () => {
      const invalidRequest = {
        ...mockGreRequest.data,
        parametros_adicionales: {
          ...mockGreRequest.data.parametros_adicionales,
          NUMERO_DOCUMENTO_CONDUCTOR: '' // Campo obligatorio vacío
        }
      };

      const validation = validateGreRequest(invalidRequest);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Número de documento del conductor es obligatorio');
    });
  });

  describe('Kafka Topics Flow', () => {
    it('should send message to gre-requests topic', async () => {
      await kafkaService.sendGreRequest(mockGreRequest);

      expect(mockKafkaClient.emit).toHaveBeenCalledWith('gre-requests', mockGreRequest);
    });

    it('should process message from gre-requests and send to gre-processing', async () => {
      // Simular el procesamiento del consumer
      const processingMessage = {
        ...mockGreRequest,
        status: 'PROCESANDO',
        nubefact_request_sent: true
      };

      await kafkaService.sendGreProcessing(processingMessage);

      expect(mockKafkaClient.emit).toHaveBeenCalledWith('gre-processing', processingMessage);
    });

    it('should handle successful response in gre-responses topic', async () => {
      await kafkaService.sendGreResponse(mockNubefactResponse);

      expect(mockKafkaClient.emit).toHaveBeenCalledWith('gre-responses', mockNubefactResponse);
    });

    it('should handle failed requests in gre-failed topic', async () => {
      const failedResponse = {
        id: 'test-uuid-123',
        status: 'error',
        error: 'API NUBEFACT no disponible',
        nubefact_response: null
      };

      await kafkaService.sendGreFailed(failedResponse);

      expect(mockKafkaClient.emit).toHaveBeenCalledWith('gre-failed', failedResponse);
    });
  });

  describe('GRE Status State Machine', () => {
    it('should transition from PENDIENTE to PROCESANDO', () => {
      const statusMachine = new GreStatusMachine();

      expect(statusMachine.canTransition('PENDIENTE', 'PROCESANDO')).toBe(true);
      expect(statusMachine.canTransition('PENDIENTE', 'COMPLETADO')).toBe(false);
    });

    it('should transition from PROCESANDO to COMPLETADO when all URLs received', () => {
      const statusMachine = new GreStatusMachine();

      expect(statusMachine.canTransition('PROCESANDO', 'COMPLETADO')).toBe(true);
    });

    it('should transition to FALLADO from any state on error', () => {
      const statusMachine = new GreStatusMachine();

      expect(statusMachine.canTransition('PENDIENTE', 'FALLADO')).toBe(true);
      expect(statusMachine.canTransition('PROCESANDO', 'FALLADO')).toBe(true);
    });
  });

  describe('Polling Service Simulation', () => {
    it('should simulate persistent polling until URLs are available', async () => {
      const pollingSim = new PollingServiceSimulator();

      // Simular respuestas de NUBEFACT con URLs nulos inicialmente
      const responses = [
        { pdf_url: null, xml_url: null, cdr_url: null },
        { pdf_url: null, xml_url: null, cdr_url: null },
        { pdf_url: 'url1', xml_url: 'url2', cdr_url: 'url3' } // Finalmente completo
      ];

      pollingSim.setMockResponses(responses);

      const result = await pollingSim.pollUntilComplete('test-uuid-123');

      expect(result.attempts).toBe(3);
      expect(result.success).toBe(true);
      expect(result.finalResponse.pdf_url).toBe('url1');
    });

    it('should timeout after max attempts', async () => {
      const pollingSim = new PollingServiceSimulator(2); // Max 2 intentos

      const responses = [
        { pdf_url: null, xml_url: null, cdr_url: null },
        { pdf_url: null, xml_url: null, cdr_url: null },
        { pdf_url: null, xml_url: null, cdr_url: null }
      ];

      pollingSim.setMockResponses(responses);

      const result = await pollingSim.pollUntilComplete('test-uuid-123');

      expect(result.attempts).toBe(2);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('NUBEFACT API Integration Mock', () => {
    it('should simulate successful generar_guia API call', async () => {
      const nubefactMock = new NubefactApiMock();

      const response = await nubefactMock.generarGuia(mockGreRequest.data);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('enlace_del_pdf');
      expect(response.data).toHaveProperty('enlace_del_xml');
      expect(response.data).toHaveProperty('enlace_del_cdr');
    });

    it('should simulate consultar_guia API with progressive URL availability', async () => {
      const nubefactMock = new NubefactApiMock();

      // Primera consulta - URLs nulos
      let response = await nubefactMock.consultarGuia('test-123');
      expect(response.data.enlace_del_pdf).toBeNull();

      // Simular que después de un tiempo las URLs están disponibles
      nubefactMock.makeUrlsAvailable('test-123');

      response = await nubefactMock.consultarGuia('test-123');
      expect(response.data.enlace_del_pdf).toBeTruthy();
      expect(response.data.enlace_del_xml).toBeTruthy();
      expect(response.data.enlace_del_cdr).toBeTruthy();
    });
  });
});

// Helper classes para simular el comportamiento sin base de datos

class GreStatusMachine {
  private validTransitions = {
    'PENDIENTE': ['PROCESANDO', 'FALLADO'],
    'PROCESANDO': ['COMPLETADO', 'FALLADO'],
    'COMPLETADO': [],
    'FALLADO': []
  };

  canTransition(from: string, to: string): boolean {
    return this.validTransitions[from]?.includes(to) || false;
  }
}

class PollingServiceSimulator {
  private mockResponses: any[] = [];
  private currentAttempt = 0;
  private maxAttempts: number;

  constructor(maxAttempts: number = 10) {
    this.maxAttempts = maxAttempts;
  }

  setMockResponses(responses: any[]) {
    this.mockResponses = responses;
    this.currentAttempt = 0;
  }

  async pollUntilComplete(id: string): Promise<any> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const responseIndex = Math.min(attempt - 1, this.mockResponses.length - 1);
      const response = this.mockResponses[responseIndex];

      if (response && response.pdf_url && response.xml_url && response.cdr_url) {
        return {
          attempts: attempt,
          success: true,
          finalResponse: response
        };
      }

      // Simular delay entre intentos
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      attempts: this.maxAttempts,
      success: false,
      error: 'Polling timeout - URLs not available after max attempts'
    };
  }
}

class NubefactApiMock {
  private urlsAvailable: { [key: string]: boolean } = {};

  async generarGuia(data: any): Promise<any> {
    // Simular validación básica
    if (!data.operacion || data.operacion !== 'generar_guia') {
      return {
        success: false,
        error: 'Operación inválida'
      };
    }

    const id = `mock-${Date.now()}`;

    return {
      success: true,
      data: {
        enlace_del_pdf: null, // Inicialmente null como en la realidad
        enlace_del_xml: null,
        enlace_del_cdr: null,
        id: id
      }
    };
  }

  async consultarGuia(id: string): Promise<any> {
    if (this.urlsAvailable[id]) {
      return {
        success: true,
        data: {
          enlace_del_pdf: `https://nubefact.com/pdf/${id}.pdf`,
          enlace_del_xml: `https://nubefact.com/xml/${id}.xml`,
          enlace_del_cdr: `https://nubefact.com/cdr/${id}.zip`
        }
      };
    }

    return {
      success: true,
      data: {
        enlace_del_pdf: null,
        enlace_del_xml: null,
        enlace_del_cdr: null
      }
    };
  }

  makeUrlsAvailable(id: string) {
    this.urlsAvailable[id] = true;
  }
}

// Función de validación basada en el plan
function validateGreRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validación RUC
  if (data.cliente_tipo_de_documento === 6) {
    if (!/^\d{11}$/.test(data.cliente_numero_de_documento)) {
      errors.push('RUC debe tener 11 dígitos');
    }
  }

  // Validación DNI conductor
  if (!/^\d{8}$/.test(data.parametros_adicionales?.NUMERO_DOCUMENTO_CONDUCTOR || '')) {
    errors.push('Número de documento del conductor es obligatorio');
  }

  // Validación UBIGEO
  if (!/^\d{6}$/.test(data.parametros_adicionales?.UBIGEO_PARTIDA || '')) {
    errors.push('UBIGEO debe tener 6 dígitos');
  }

  // Validación campos obligatorios
  if (!data.cliente_denominacion) {
    errors.push('Denominación del cliente es obligatoria');
  }

  if (!data.parametros_adicionales?.DIRECCION_PARTIDA) {
    errors.push('Dirección de partida es obligatoria');
  }

  if (!data.parametros_adicionales?.NOMBRES_CONDUCTOR) {
    errors.push('Nombres del conductor son obligatorios');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}