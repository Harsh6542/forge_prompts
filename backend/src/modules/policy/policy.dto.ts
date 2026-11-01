import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class PolicyDocumentDto {
  @ApiProperty({ example: 'PM KISAN Samman Nidhi' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  schemeName!: string;

  @ApiProperty({ enum: ['scheme', 'law', 'policy'] })
  @IsEnum(['scheme', 'law', 'policy'])
  category!: 'scheme' | 'law' | 'policy';

  @ApiProperty({ required: false, nullable: true, example: null })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string | null;

  @ApiProperty({ example: 'https://pmkisan.gov.in' })
  @IsUrl()
  sourceUrl!: string;

  @ApiProperty({ description: 'Full document text to chunk' })
  @IsString()
  @MinLength(50)
  content!: string;
}

export class PolicyIngestDto {
  @ApiProperty({ type: [PolicyDocumentDto] })
  @IsArray()
  documents!: PolicyDocumentDto[];
}

export class PolicyQueryDto {
  @ApiProperty({ example: 'What financial help do farmers get?' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  query!: string;

  @ApiProperty({ default: 'en', description: "Response language code, e.g. 'hi'" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ default: false })
  @IsOptional()
  @IsIn(['true', 'false', true, false] as const)
  generateVoice?: boolean | string;

  @ApiProperty({ required: false, enum: ['scheme', 'law', 'policy'] })
  @IsOptional()
  @IsEnum(['scheme', 'law', 'policy'])
  category?: 'scheme' | 'law' | 'policy';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string;
}
