import { Module, Global } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';

@Global() // Esto hace que el módulo esté disponible globalmente
@Module({
  providers: [WebsocketGateway],
  exports: [WebsocketGateway], // Exportamos para que otros módulos puedan usarlo
})
export class WebsocketModule {}
