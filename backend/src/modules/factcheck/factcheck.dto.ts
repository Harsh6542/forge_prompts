import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class FactCheckRequestDto {
  @ApiProperty({
    example: 'Government announced free electricity for all farmers from next month, saw it on WhatsApp',
  })
  @IsString()
  @MinLength(15)
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({ description: 'Image URL to run forensics on' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mediaUrl?: string;

  @ApiPropertyOptional({ enum: ['political', 'health', 'disaster', 'financial', 'social'] })
  @IsOptional()
  @IsIn(['political', 'health', 'disaster', 'financial', 'social'])
  claimType?: string;
}
