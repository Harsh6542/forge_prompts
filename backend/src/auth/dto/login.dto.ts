import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'aarav@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Str0ngPass!' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
