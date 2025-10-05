import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';

export class SeaLevelDto {
  @ApiProperty({ example: '9414290', description: 'NOAA station ID' })
  @IsString()
  stationId: string;

  @ApiProperty({ example: 'San Francisco', description: 'Station name' })
  @IsString()
  stationName: string;

  @ApiProperty({
    example: 'Point',
    description: 'GeoJSON type',
  })
  @IsString()
  @IsOptional()
  locationType?: string;

  @ApiProperty({
    example: [-122.4659, 37.8063],
    description: 'GeoJSON coordinates [longitude, latitude]',
  })
  coordinates: number[];

  @ApiProperty({ example: 1.234, description: 'Water level in meters' })
  @IsNumber()
  waterLevel: number;

  @ApiPropertyOptional({
    example: 0.037,
    description: 'Standard deviation (sigma)',
  })
  @IsNumber()
  @IsOptional()
  sigma?: number;

  @ApiPropertyOptional({ example: '0,0,0,0', description: 'Quality flags' })
  @IsString()
  @IsOptional()
  flags?: string;

  @ApiPropertyOptional({
    example: 'p',
    description: 'Quality indicator (p=preliminary, v=verified)',
  })
  @IsString()
  @IsOptional()
  quality?: string;

  @ApiProperty({ example: 'MLLW', description: 'Datum reference' })
  @IsString()
  datum: string;

  @ApiProperty({
    example: '2025-10-04T08:00:00.000Z',
    description: 'Measurement timestamp',
  })
  @IsDateString()
  timestamp: Date;

  @ApiProperty({ example: 'NOAA', description: 'Data source' })
  @IsString()
  source: string;
}

export class SeaLevelHistoryQueryDto {
  @ApiPropertyOptional({
    example: '2025-09-27T00:00:00',
    description: 'Start date (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    example: '2025-10-04T23:59:59',
    description: 'End date (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    example: 'p',
    description: 'Quality filter (p=preliminary, v=verified)',
    enum: ['p', 'v'],
  })
  @IsIn(['p', 'v'])
  @IsOptional()
  quality?: string;
}
