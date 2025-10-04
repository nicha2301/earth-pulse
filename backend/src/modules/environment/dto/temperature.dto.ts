import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class TemperatureDto {
  @ApiProperty({ example: 'New York' })
  @IsString()
  location: string;

  @ApiProperty({ example: 'USA' })
  @IsString()
  country: string;

  @ApiProperty({ example: 22.5 })
  @IsNumber()
  temperature: number;

  @ApiProperty({ example: 21.8 })
  @IsNumber()
  @IsOptional()
  feelsLike?: number;

  @ApiProperty({ example: 65 })
  @IsNumber()
  @IsOptional()
  humidity?: number;

  @ApiProperty({ example: 1013 })
  @IsNumber()
  @IsOptional()
  pressure?: number;

  @ApiProperty({ example: 'Partly cloudy' })
  @IsString()
  @IsOptional()
  weatherDescription?: string;

  @ApiProperty({
    example: {
      lat: 40.7128,
      lon: -74.006,
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
