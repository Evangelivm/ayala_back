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
}
