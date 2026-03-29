import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableCors({ origin: '*' });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Logger Service API')
    .setDescription('Centralized log aggregation and query service')
    .setVersion('1.0')
    .addTag('Logs')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.LOGGER_PORT ?? 3001;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Logger service running on http://localhost:${port}`);
  logger.log(`Log viewer at http://localhost:${port}/`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
