import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { getDatabaseConfig } from './database/config/database.config.js';
import { GrievanceModule } from './modules/grievance/grievance.module.js';
import { ServiceAgentModule } from './modules/service-agent/service-agent.module.js';
import { FactCheckModule } from './modules/factcheck/factcheck.module.js';
import { PolicyModule } from './modules/policy/policy.module.js';
import { InputPipelineModule } from './shared/input-pipeline/input-pipeline.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();



@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SequelizeModule.forRootAsync({
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    AuthModule,
    InputPipelineModule,
    PolicyModule,
    GrievanceModule,
    ServiceAgentModule,
    FactCheckModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

// reload env

// reconnect

// bounce

// service-agent wired

// demo mode

// factcheck wired

// auth lockdown

// jwt module wired
