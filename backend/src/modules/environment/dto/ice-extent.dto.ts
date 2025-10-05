import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsDateString, IsEnum, IsOptional } from 'class-validator';

export class IceExtentDto {
  @ApiProperty({
    description: 'Region (Arctic or Antarctic)',
    example: 'Arctic',
    enum: ['Arctic', 'Antarctic'],
  })
  @IsString()
  @IsEnum(['Arctic', 'Antarctic'])
  region: string;

  @ApiProperty({
    description: 'Hemisphere (N for North/Arctic, S for South/Antarctic)',
    example: 'N',
    enum: ['N', 'S'],
  })
  @IsString()
  @IsEnum(['N', 'S'])
  hemisphere: string;

  @ApiProperty({
    description: 'Date of measurement (ISO 8601 format)',
    example: '2025-10-02T00:00:00.000Z',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Sea ice extent in million square kilometers',
    example: 5.291,
  })
  @IsNumber()
  extent: number;

  @ApiProperty({
    description: 'Missing data indicator in million square kilometers',
    example: 0.000,
    default: 0,
  })
  @IsNumber()
  missing: number;

  @ApiProperty({
    description: 'Source data file reference',
    example: '["/ecs/DP1/PM/NSIDC-0051.001/2025.10.02/nt_20251002_n07_v1.1_n.bin"]',
  })
  @IsString()
  source: string;

  @ApiPropertyOptional({
    description: 'Data source provider',
    example: 'NSIDC',
    default: 'NSIDC',
  })
  @IsOptional()
  @IsString()
  dataSource?: string;
}

export class IceExtentQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by region (Arctic or Antarctic)',
    example: 'Arctic',
    enum: ['Arctic', 'Antarctic'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['Arctic', 'Antarctic'])
  region?: string;

  @ApiPropertyOptional({
    description: 'Start date for historical data query (ISO 8601 format)',
    example: '2025-09-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date for historical data query (ISO 8601 format)',
    example: '2025-10-02',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
