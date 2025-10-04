import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TemperatureService } from '../services/temperature.service';
import { TemperatureDto } from '../dto/temperature.dto';

@ApiTags('temperature')
@Controller('temperature')
export class TemperatureController {
  constructor(private readonly temperatureService: TemperatureService) {}

  @Get('locations')
  @ApiOperation({ summary: 'Get list of all available locations' })
  @ApiResponse({ status: 200, description: 'List of locations' })
  async getLocations() {
    const locations = await this.temperatureService.getLocationList();
    return {
      count: locations.length,
      locations,
    };
  }

  @Get('map')
  @ApiOperation({ summary: 'Get latest temperature data for all locations (for map display)' })
  @ApiResponse({ status: 200, description: 'Latest temperature data for all locations' })
  async getMapData() {
    const data = await this.temperatureService.getAllLatest();
    return {
      count: data.length,
      data: data.map((item) => ({
        location: item.location,
        country: item.country,
        temperature: item.temperature,
        feelsLike: item.feelsLike,
        weatherDescription: item.weatherDescription,
        coordinates: item.coordinates,
        timestamp: item.timestamp,
      })),
    };
  }

  @Get('global-average')
  @ApiOperation({ summary: 'Get global average temperature' })
  @ApiResponse({ status: 200, description: 'Global average temperature' })
  async getGlobalAverage() {
    const avgTemp = await this.temperatureService.getGlobalAverage();
    return {
      globalAverage: avgTemp,
      unit: 'Celsius',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':location')
  @ApiOperation({ summary: 'Get latest temperature data for a specific location' })
  @ApiParam({ name: 'location', example: 'New York' })
  @ApiResponse({ status: 200, description: 'Temperature data', type: TemperatureDto })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async getByLocation(@Param('location') location: string) {
    return await this.temperatureService.getLatestByLocation(location);
  }

  @Get(':location/history')
  @ApiOperation({ summary: 'Get historical temperature data for a location' })
  @ApiParam({ name: 'location', example: 'New York' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Historical temperature data' })
  async getHistory(
    @Param('location') location: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    const data = await this.temperatureService.getHistoricalData(location, fromDate, toDate);

    return {
      location,
      count: data.length,
      data,
    };
  }
}
