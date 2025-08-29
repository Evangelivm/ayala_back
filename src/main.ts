import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar CORS
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Configurar prefijo global
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
  await app.listen(port);
}
bootstrap();
