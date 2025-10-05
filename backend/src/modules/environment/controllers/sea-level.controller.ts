import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SeaLevelService } from '../services/sea-level.service';
import { SeaLevelHistoryQueryDto } from '../dto/sea-level.dto';

@ApiTags('Sea Level')
@Controller('sea-level')
export class SeaLevelController {
  private readonly logger = new Logger(SeaLevelController.name);

  constructor(private readonly seaLevelService: SeaLevelService) {}

  @Get('stations')
  @ApiOperation({ summary: 'Get all sea level monitoring stations' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of all available stations with latest readings',
  })
  async getAllStations() {
    this.logger.log('GET /sea-level/stations');
    return this.seaLevelService.getAllStations();
  }

  @Get('map')
  @ApiOperation({ summary: 'Get sea level data optimized for map visualization' })
  @ApiResponse({
    status: 200,
    description: 'Returns simplified sea level data for all stations',
  })
  async getSeaLevelMap() {
    this.logger.log('GET /sea-level/map');
    return this.seaLevelService.getSeaLevelMap();
  }

  @Get('trend')
  @ApiOperation({ summary: 'Get global sea level trends and statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns trend analysis for all stations (last 24 hours)',
  })
  async getGlobalTrend() {
    this.logger.log('GET /sea-level/trend');
    return this.seaLevelService.getGlobalTrend();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get overall sea level statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns statistics about data collection and coverage',
  })
  async getStatistics() {
    this.logger.log('GET /sea-level/stats');
    return this.seaLevelService.getStatistics();
  }

  @Get(':stationId')
  @ApiOperation({ summary: 'Get latest sea level reading for a specific station' })
  @ApiParam({
    name: 'stationId',
    description: 'NOAA station ID (e.g., 9414290 for San Francisco)',
    example: '9414290',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns latest water level reading for the station',
  })
  @ApiResponse({
    status: 404,
    description: 'Station not found or no data available',
  })
  async getStationLatest(@Param('stationId') stationId: string) {
    this.logger.log(`GET /sea-level/${stationId}`);
    return this.seaLevelService.getStationLatest(stationId);
  }

  @Get(':stationId/history')
  @ApiOperation({ summary: 'Get historical sea level data for a station' })
  @ApiParam({
    name: 'stationId',
    description: 'NOAA station ID',
    example: '9414290',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date (ISO 8601 format)',
    example: '2025-09-27T00:00:00',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (ISO 8601 format)',
    example: '2025-10-04T23:59:59',
  })
  @ApiQuery({
    name: 'quality',
    required: false,
    description: 'Data quality filter (p=preliminary, v=verified)',
    enum: ['p', 'v'],
  })
  @ApiResponse({
    status: 200,
    description: 'Returns historical water level readings',
  })
  async getStationHistory(
    @Param('stationId') stationId: string,
    @Query() query: SeaLevelHistoryQueryDto,
  ) {
    this.logger.log(`GET /sea-level/${stationId}/history`);

    const from = query.from ? new Date(query.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    return this.seaLevelService.getStationHistory(
      stationId,
      from,
      to,
      query.quality,
    );
  }
}
