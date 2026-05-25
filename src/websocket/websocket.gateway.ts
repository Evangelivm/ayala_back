import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // En producción, especifica tu dominio del frontend
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }

  // Emitir evento cuando se actualice una orden de compra
  emitOrdenCompraUpdate() {
    this.server.emit('ordenCompraUpdated');
  }

  // Emitir evento cuando se actualice una orden de servicio
  emitOrdenServicioUpdate() {
    this.server.emit('ordenServicioUpdated');
  }

  // Emitir el siguiente número de orden de compra disponible
  emitSiguienteNumeroOrdenCompra(data: {
    serie: string;
    nroDoc: string;
    numero_orden_completo: string;
  }) {
    this.server.emit('siguienteNumeroOrdenCompra', data);
  }

  // Emitir el siguiente número de orden de servicio disponible
  emitSiguienteNumeroOrdenServicio(data: {
    serie: string;
    nroDoc: string;
    numero_orden_completo: string;
  }) {
    this.server.emit('siguienteNumeroOrdenServicio', data);
  }

  // Emitir evento cuando se actualice una guía de remisión
  emitGuiaRemisionUpdate() {
    this.server.emit('guiaRemisionUpdated');
  }

  // Emitir el siguiente número de guía de remisión disponible
  emitSiguienteNumeroGuiaRemision(data: { numero: number }) {
    this.server.emit('siguienteNumeroGuiaRemision', data);
  }

  // Emitir cuando una programación técnica se completa (GRE procesada)
  emitProgTecnicaCompletada(data: {
    id: number;
    identificador_unico: string;
    pdf_link?: string;
    xml_link?: string;
    cdr_link?: string;
  }) {
    try {
      console.log(`📡 Emitiendo evento progTecnicaCompletada:`, data);

      if (!this.server) {
        console.error('❌ WebSocket server no inicializado');
        return;
      }

      this.server.emit('prog-tecnica-completada', {
        event: 'prog-tecnica-completada',
        ...data,
      });
      console.log(`✅ Evento prog-tecnica-completada emitido exitosamente`);
    } catch (error) {
      console.error(
        '❌ Error emitiendo evento prog-tecnica-completada:',
        error,
      );
      // No lanzar el error para no interrumpir el flujo
    }
  }

  // Emitir cuando una factura cambia de estado
  emitFacturaUpdate(data: {
    id_factura: number;
    estado: string;
    enlace_pdf?: string;
    enlace_xml?: string;
    enlace_cdr?: string;
    aceptada_por_sunat?: boolean | null;
  }) {
    try {
      console.log(`📡 Emitiendo evento facturaUpdated:`, data);

      if (!this.server) {
        console.error('❌ WebSocket server no inicializado');
        return;
      }

      this.server.emit('facturaUpdated', data);
      console.log(`✅ Evento facturaUpdated emitido exitosamente`);
    } catch (error) {
      console.error('❌ Error emitiendo evento facturaUpdated:', error);
      // No lanzar el error para no interrumpir el flujo
    }
  }
}
