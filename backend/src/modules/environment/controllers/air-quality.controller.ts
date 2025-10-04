import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AirQualityService } from '../services/air-quality.service';
import { AirQualityDto } from '../dto/air-quality.dto';

@ApiTags('air-quality')
@Controller('air-quality')
export class AirQualityController {
  constructor(private readonly airQualityService: AirQualityService) {}

  @Get('cities')
  @ApiOperation({ summary: 'Get list of all available cities' })
  @ApiResponse({ status: 200, description: 'List of cities' })
  async getCities() {
    const cities = await this.airQualityService.getCityList();
    return {
      count: cities.length,
      cities,
    };
  }

  @Get('map')
  @ApiOperation({ summary: 'Get latest air quality data for all cities (for map display)' })
  @ApiResponse({ status: 200, description: 'Latest air quality data for all cities' })
  async getMapData() {
    const data = await this.airQualityService.getAllLatest();
    return {
      count: data.length,
      data: data.map((item) => ({
        city: item.city,
        country: item.country,
        aqi: item.aqi,
        level: item.level,
        coordinates: item.coordinates,
        timestamp: item.timestamp,
      })),
    };
  }

  @Get(':city')
  @ApiOperation({ summary: 'Get latest air quality data for a specific city' })
  @ApiParam({ name: 'city', example: 'hanoi' })
  @ApiResponse({ status: 200, description: 'Air quality data', type: AirQualityDto })
  @ApiResponse({ status: 404, description: 'City not found' })
  async getByCity(@Param('city') city: string) {
    return await this.airQualityService.getLatestByCity(city);
  }

  @Get(':city/history')
  @ApiOperation({ summary: 'Get historical air quality data for a city' })
  @ApiParam({ name: 'city', example: 'hanoi' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Historical air quality data' })
  async getHistory(
    @Param('city') city: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    const data = await this.airQualityService.getHistoricalData(city, fromDate, toDate);

    return {
      city,
      count: data.length,
      data,
    };
  }
}
