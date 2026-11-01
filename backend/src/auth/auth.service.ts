import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity.js';
import { RbacService } from '../rbac.service.js';
import { SafeUser, AuthedRequestUser } from './types.js';
import {
  AssignableDepartment,
  UserRoleEnum,
} from './dto/set-department.dto.js';

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH =
  '$2b$12$DRrDXhXiT.i2fnsGaXVfmei5skkC1WcMHOIQNXzOJeRUvVMoznHpy';

export interface LoginResult {
  accessToken: string;
  user: SafeUser;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private rbacService: RbacService,
  ) {}

  async register(name: string, email: string, password: string): Promise<SafeUser> {
    email = email.trim().toLowerCase();

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    try {
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const user = await User.create({
        name,
        email,
        passwordHash: hash,
        role: 'public_user' as const,
        department: null,
      });
      return this.toSafeUser(user);
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        (err as { name?: string }).name === 'SequelizeUniqueConstraintError'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }
  }

  async login(email: string, password: string): Promise<LoginResult> {
    email = email.trim().toLowerCase();
    const user = await User.findOne({ where: { email } });

    // Always burn a bcrypt compare so response time doesn't reveal
    // whether the email exists (timing / user-enumeration protection).
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      accessToken: this.signToken(user),
      user: this.toSafeUser(user),
    };
  }

  signToken(user: User): string {
    const payload = {
      sub: user.get('id') as number,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    };
    return this.jwtService.sign(payload);
  }

  async getSafeUserById(id: number): Promise<SafeUser> {
    const user = await User.findByPk(id);
    if (!user) throw new UnauthorizedException('User not found');
    return this.toSafeUser(user);
  }

  async listUsers(role?: string): Promise<SafeUser[]> {
    const users = role
      ? await User.findAll({ where: { role }, order: [['id', 'ASC']] })
      : await User.findAll({ order: [['id', 'ASC']] });
    return users.map((u) => this.toSafeUser(u));
  }

  async setDepartment(email: string, role: UserRoleEnum, department?: string): Promise<SafeUser> {
    email = email.trim().toLowerCase();
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('No user found with that email');
    }
    return this.applyRole(user, role, department);
  }

  async updateUserRole(
    actor: AuthedRequestUser,
    email: string,
    role: UserRoleEnum,
    department?: string,
  ): Promise<SafeUser> {
    email = email.trim().toLowerCase();

    if (email === actor.email) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('No user found with that email');
    }

    if (
      user.role === 'superadmin' &&
      role !== UserRoleEnum.SUPERADMIN &&
      actor.role === 'superadmin'
    ) {
      const superCount = await User.count({ where: { role: 'superadmin' } });
      if (superCount <= 1) {
        throw new ForbiddenException(
          'Cannot demote the last superadmin — promote another superadmin first',
        );
      }
    }

    return this.applyRole(user, role, department);
  }

  private async applyRole(
    user: User,
    role: UserRoleEnum,
    department?: string,
  ): Promise<SafeUser> {
    const isDeptRole = role !== 'superadmin' && role !== 'public_user';

    let dept: string | null = null;
    if (isDeptRole) {
      dept = department ?? null;
      if (!dept || !Object.values(AssignableDepartment).includes(dept as AssignableDepartment)) {
        const expected = this.rbacService.getDeptForRole(role);
        throw new BadRequestException(
          `Department is required for role '${role}' (expected one of: ${expected}, ${Object.values(AssignableDepartment).join(', ')})`,
        );
      }
    }

    user.set('role', role);
    user.set('department', dept);
    try {
      await user.save();
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        (err as { name?: string }).name === 'SequelizeUniqueConstraintError'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }
    return this.toSafeUser(user);
  }

  listDepartments() {
    const departments = [
      { code: 'PWD', name: 'Public Works Department (PWD)', role: 'pwd_admin', categories: this.rbacService.getCategoriesForDepartment('PWD') },
      { code: 'JalBoard', name: 'Jal Board / Water Authority', role: 'jalboard_admin', categories: this.rbacService.getCategoriesForDepartment('JalBoard') },
      { code: 'Municipal', name: 'Municipal Corporation', role: 'municipal_admin', categories: this.rbacService.getCategoriesForDepartment('Municipal') },
    ];
    return { departments };
  }

  toSafeUser(u: User): SafeUser {
    return {
      id: u.get('id') as number,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      createdAt: u.createdAt as unknown as Date,
      updatedAt: u.updatedAt as unknown as Date,
    };
  }
}
