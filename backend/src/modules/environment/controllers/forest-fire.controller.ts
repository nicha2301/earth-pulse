import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ForestFireService } from '../services/forest-fire.service';
import { FireHistoryQueryDto } from '../dto/forest-fire.dto';

@ApiTags('Forest Fires')
@Controller('forest-fires')
export class ForestFireController {
  private readonly logger = new Logger(ForestFireController.name);

  constructor(private readonly forestFireService: ForestFireService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get all active fires (last 24 hours)' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of active fires detected in the last 24 hours',
  })
  async getActiveFires() {
    this.logger.log('GET /forest-fires/active');
    const fires = await this.forestFireService.getActiveFires();
    return {
      count: fires.length,
      fires,
      timestamp: new Date(),
    };
  }

  @Get('map')
  @ApiOperation({
    summary: 'Get fires data optimized for map visualization',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns simplified fire data for map markers',
  })
  async getFiresForMap() {
    this.logger.log('GET /forest-fires/map');
    const fires = await this.forestFireService.getFiresForMap();
    return {
      count: fires.length,
      data: fires,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get historical fire data' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'confidence', required: false, type: String, description: 'Filter by confidence level' })
  @ApiResponse({
    status: 200,
    description: 'Returns historical fire detections',
  })
  async getFireHistory(@Query() query: FireHistoryQueryDto) {
    this.logger.log(`GET /forest-fires/history - Query: ${JSON.stringify(query)}`);
    
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const result = await this.forestFireService.getFireHistory(
      from,
      to,
      query.confidence,
    );

    return result;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get fire statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns statistics about active fires',
  })
  async getFireStats() {
    this.logger.log('GET /forest-fires/stats');
    return await this.forestFireService.getFireStats();
  }
}
