import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GrievanceSubmitDto {
  @ApiProperty({ example: 'Huge pothole in front of the bus stand devours bikes daily' })
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ enum: ['road', 'water', 'garbage', 'electricity', 'pollution', 'flood', 'other'] })
  @IsEnum(['road', 'water', 'garbage', 'electricity', 'pollution', 'flood', 'other'])
  category!: 'road' | 'water' | 'garbage' | 'electricity' | 'pollution' | 'flood' | 'other';

  @ApiProperty({ example: 'Near Gandhi Nagar Bus Stand, Sector 21, Pune' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  location!: string;

  @ApiPropertyOptional({ example: 'Maharashtra' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
}
