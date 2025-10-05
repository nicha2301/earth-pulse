import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsDateString, IsOptional } from 'class-validator';

export class ForestFireDto {
  @ApiProperty({ description: 'Latitude of fire location' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ description: 'Longitude of fire location' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ description: 'Brightness temperature in Kelvin' })
  @IsNumber()
  brightness: number;

  @ApiProperty({ description: 'Confidence level: low, nominal, or high' })
  @IsString()
  confidence: string;

  @ApiProperty({ description: 'Fire Radiative Power in MW' })
  @IsNumber()
  frp: number;

  @ApiProperty({ description: 'Satellite name' })
  @IsString()
  satellite: string;

  @ApiProperty({ description: 'Instrument name' })
  @IsString()
  instrument: string;

  @ApiProperty({ description: 'Acquisition date (YYYY-MM-DD)' })
  @IsString()
  acq_date: string;

  @ApiProperty({ description: 'Acquisition time (HHMM)' })
  @IsString()
  acq_time: string;

  @ApiProperty({ description: 'Day or Night: D or N' })
  @IsString()
  daynight: string;

  @ApiProperty({ description: 'Detection timestamp' })
  @IsDateString()
  timestamp: Date;
}

export class FireHistoryQueryDto {
  @ApiProperty({ required: false, description: 'Start date (ISO format)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'End date (ISO format)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, description: 'Confidence level filter' })
  @IsOptional()
  @IsString()
  confidence?: string;
}
