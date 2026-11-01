import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { User } from '../database/entities/user.entity.js';
import { RbacService } from '../rbac.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

@Module({
  imports: [
    SequelizeModule.forFeature([User]),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret',
      signOptions: { expiresIn: (JWT_EXPIRES_IN ?? '7d') as never },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, RbacService],
  exports: [AuthService, RbacService, JwtModule],
})
export class AuthModule {}
