import { ValidationPipe, RequestMethod, ClassSerializerInterceptor } from '@nestjs/common'
import { NestFactory, Reflector } from '@nestjs/core'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { DataSource } from 'typeorm'
import * as dotenv from 'dotenv'
import * as bodyParser from 'body-parser'
import * as express from 'express'
import * as path from 'path'

async function bootstrap() {
  dotenv.config()

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  })

  app.enableCors()

  // Serve uploaded files (bug report screenshots, etc.)
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

  app.use(bodyParser.json({ limit: '10mb' }))

  // ZKTeco ICLOCK devices send plain-text bodies — must be registered before global prefix
  app.use('/iclock', bodyParser.text({ type: '*/*', limit: '10mb' }))

  app.setGlobalPrefix(process.env.API_PREFIX || 'api', {
    exclude: [
      { path: 'iclock/cdata', method: RequestMethod.ALL },
      { path: 'iclock/getrequest', method: RequestMethod.ALL },
      { path: 'iclock/devicecmd', method: RequestMethod.ALL },
    ],
  })

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  )

  app.useGlobalFilters(new AllExceptionsFilter(app.get(DataSource)))

  await app.listen(process.env.PORT || 3001)
}
bootstrap()
