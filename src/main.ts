import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurar CORS
  app.enableCors({
    origin: [process.env.FRONTEND_URL],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
    // credentials: true,
  });

  // Configurar prefijo global
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
  await app.listen(port);
}
bootstrap();
