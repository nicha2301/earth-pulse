import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class AirQualityDto {
  @ApiProperty({ example: 'Hanoi' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Vietnam' })
  @IsString()
  country: string;

  @ApiProperty({ example: 156 })
  @IsNumber()
  aqi: number;

  @ApiProperty({ example: 'Unhealthy' })
  @IsString()
  @IsOptional()
  level?: string;

  @ApiProperty({
    example: {
      pm25: 65.4,
      pm10: 89.2,
      o3: 45.1,
      no2: 32.8,
    },
  })
  @IsObject()
  @IsOptional()
  pollutants?: {
    pm25?: number;
    pm10?: number;
    o3?: number;
    no2?: number;
    so2?: number;
    co?: number;
  };

  @ApiProperty({
    example: {
      lat: 21.0285,
      lon: 105.8542,
    },
  })
  @IsObject()
  coordinates: {
    lat: number;
    lon: number;
  };

  @ApiProperty()
  @IsString()
  timestamp: string;
}
