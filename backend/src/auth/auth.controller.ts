import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Roles } from './decorators/roles.decorator.js';
import { UpdateRoleDto } from './dto/set-department.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AuthGuard } from '../guards/auth.guard.js';
import { RoleGuard } from '../guards/role.guard.js';
import type { AuthedRequestUser } from './types.js';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Public user signup' })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.name, dto.email, dto.password);
  }

  @ApiOperation({ summary: 'Login, returns JWT access token' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto) {
    const { accessToken, user } = await this.authService.login(
      dto.email,
      dto.password,
    );
    return { accessToken, user };
  }

  @ApiOperation({ summary: 'Current user from JWT' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser('id') userId: number) {
    return this.authService.getSafeUserById(userId);
  }

  @ApiOperation({ summary: 'All users, filterable by role (superadmin only)' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @Roles('superadmin')
  @Get('users')
  listUsers(@Query('role') role?: string) {
    return this.authService.listUsers(role);
  }

  @ApiOperation({ summary: 'Assign role + department (superadmin only)' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @Roles('superadmin')
  @Patch('users/role')
  updateUserRole(
    @CurrentUser() actor: AuthedRequestUser,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.authService.updateUserRole(
      actor,
      dto.email,
      dto.role,
      dto.department,
    );
  }

  @ApiOperation({ summary: 'Set up a department admin (superadmin only)' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RoleGuard)
  @Roles('superadmin')
  @Post('set-department')
  setDepartment(@Body() dto: UpdateRoleDto) {
    return this.authService.setDepartment(dto.email, dto.role, dto.department);
  }

  @ApiOperation({ summary: 'Departments with their admin-role mapping' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('departments')
  departments() {
    return this.authService.listDepartments();
  }
}
