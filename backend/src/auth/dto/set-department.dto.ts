import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

/** Department codes — must match rbac.service.ts USER_DEPARTMENT. */
export enum AssignableDepartment {
  PWD = 'PWD',
  JALBOARD = 'JalBoard',
  MUNICIPAL = 'Municipal',
}

/** All assignable roles — must match user.entity.ts role enum. */
export enum UserRoleEnum {
  SUPERADMIN = 'superadmin',
  PWD_ADMIN = 'pwd_admin',
  JALBOARD_ADMIN = 'jalboard_admin',
  MUNICIPAL_ADMIN = 'municipal_admin',
  DISCO_ADMIN = 'disco_admin',
  SPCB_ADMIN = 'spcb_admin',
  SMA_ADMIN = 'sma_admin',
  PUBLIC_USER = 'public_user',
}

/** Roles that REQUIRE a department to be paired with them. */
const DEPT_ADMIN_ROLES: string[] = [
  UserRoleEnum.PWD_ADMIN,
  UserRoleEnum.JALBOARD_ADMIN,
  UserRoleEnum.MUNICIPAL_ADMIN,
  UserRoleEnum.DISCO_ADMIN,
  UserRoleEnum.SPCB_ADMIN,
  UserRoleEnum.SMA_ADMIN,
];

export class UpdateRoleDto {
  @ApiProperty({ example: 'jasmine@pwd.gov.in' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: UserRoleEnum, example: UserRoleEnum.PWD_ADMIN })
  @IsEnum(UserRoleEnum)
  role!: UserRoleEnum;

  @ApiProperty({
    enum: AssignableDepartment,
    required: false,
    nullable: true,
    example: AssignableDepartment.PWD,
  })
  @IsEnum(AssignableDepartment)
  @IsOptional()
  department?: AssignableDepartment;
}

export { DEPT_ADMIN_ROLES };
