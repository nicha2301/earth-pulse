import { Controller, Post, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CollectorService } from '../services/collector.service';
import { MetricsService } from '../services/metrics.service';

@Controller('collector')
@ApiTags('Data Collection')
export class CollectorController {
  private readonly logger = new Logger(CollectorController.name);

  constructor(
    private readonly collectorService: CollectorService,
    private readonly metricsService: MetricsService,
  ) {}

  @Post('trigger/ice-extent')
  @ApiOperation({ summary: 'Manually trigger Ice Extent data collection' })
  @ApiResponse({ status: 200, description: 'Collection triggered successfully' })
  async triggerIceExtent() {
    this.logger.log('🚀 Manual trigger: Ice Extent collection');
    await this.collectorService.collectIceExtentData();
    return {
      success: true,
      message: 'Ice Extent data collection triggered',
      timestamp: new Date(),
    };
  }

  @Post('trigger/sea-level')
  @ApiOperation({ summary: 'Manually trigger Sea Level data collection' })
  @ApiResponse({ status: 200, description: 'Collection triggered successfully' })
  async triggerSeaLevel() {
    this.logger.log('🚀 Manual trigger: Sea Level collection');
    await this.collectorService.collectSeaLevelData();
    return {
      success: true,
      message: 'Sea Level data collection triggered',
      timestamp: new Date(),
    };
  }

  @Post('trigger/all')
  @ApiOperation({ summary: 'Manually trigger ALL data collections' })
  @ApiResponse({ status: 200, description: 'All collections triggered successfully' })
  async triggerAll() {
    this.logger.log('🚀 Manual trigger: ALL collections');
    
    const results = await Promise.allSettled([
      this.collectorService.collectAirQualityData(),
      this.collectorService.collectTemperatureData(),
      this.collectorService.collectForestFireData(),
      this.collectorService.collectSeaLevelData(),
      this.collectorService.collectIceExtentData(),
    ]);

    const summary = {
      airQuality: results[0].status === 'fulfilled' ? 'success' : 'failed',
      temperature: results[1].status === 'fulfilled' ? 'success' : 'failed',
      forestFire: results[2].status === 'fulfilled' ? 'success' : 'failed',
      seaLevel: results[3].status === 'fulfilled' ? 'success' : 'failed',
      iceExtent: results[4].status === 'fulfilled' ? 'success' : 'failed',
    };

    return {
      success: true,
      message: 'All data collections triggered',
      timestamp: new Date(),
      summary,
    };
  }

  @Post('trigger/air-quality')
  @ApiOperation({ summary: 'Manually trigger Air Quality data collection' })
  @ApiResponse({ status: 200, description: 'Collection triggered successfully' })
  async triggerAirQuality() {
    this.logger.log('🚀 Manual trigger: Air Quality collection');
    await this.collectorService.collectAirQualityData();
    return {
      success: true,
      message: 'Air Quality data collection triggered',
      timestamp: new Date(),
    };
  }

  @Post('trigger/temperature')
  @ApiOperation({ summary: 'Manually trigger Temperature data collection' })
  @ApiResponse({ status: 200, description: 'Collection triggered successfully' })
  async triggerTemperature() {
    this.logger.log('🚀 Manual trigger: Temperature collection');
    await this.collectorService.collectTemperatureData();
    return {
      success: true,
      message: 'Temperature data collection triggered',
      timestamp: new Date(),
    };
  }

  @Post('trigger/forest-fire')
  @ApiOperation({ summary: 'Manually trigger Forest Fire data collection' })
  @ApiResponse({ status: 200, description: 'Collection triggered successfully' })
  async triggerForestFire() {
    this.logger.log('🚀 Manual trigger: Forest Fire collection');
    await this.collectorService.collectForestFireData();
    return {
      success: true,
      message: 'Forest Fire data collection triggered',
      timestamp: new Date(),
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get performance metrics summary' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: 'Time range in hours (default: 1)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Performance metrics',
    schema: {
      type: 'object',
      properties: {
        timeRange: { type: 'string', example: 'Last 1 hour(s)' },
        cache: {
          type: 'object',
          properties: {
            hits: { type: 'number' },
            misses: { type: 'number' },
            total: { type: 'number' },
            hitRate: { type: 'string', example: '85.50%' },
          },
        },
        api: {
          type: 'object',
          properties: {
            totalRequests: { type: 'number' },
            avgResponseTime: { type: 'string', example: '150.25ms' },
            p95ResponseTime: { type: 'string', example: '250.00ms' },
            p99ResponseTime: { type: 'string', example: '500.00ms' },
          },
        },
        database: {
          type: 'object',
          properties: {
            totalQueries: { type: 'number' },
            avgQueryTime: { type: 'string', example: '50.00ms' },
            slowQueries: { type: 'number' },
          },
        },
        collections: {
          type: 'object',
          properties: {
            totalJobs: { type: 'number' },
            successRate: { type: 'string', example: '98.50%' },
            avgDuration: { type: 'string', example: '2500.00ms' },
            failedJobs: { type: 'number' },
          },
        },
        externalApis: {
          type: 'object',
          properties: {
            totalCalls: { type: 'number' },
            successRate: { type: 'string', example: '99.00%' },
            avgDuration: { type: 'string', example: '1200.00ms' },
          },
        },
      },
    },
  })
  getMetrics(@Query('hours') hours?: number) {
    const timeRange = hours ? Math.max(1, Math.min(24, hours)) : 1;
    return this.metricsService.getMetricsSummary(timeRange);
  }

  @Get('metrics/count')
  @ApiOperation({ summary: 'Get current metrics count' })
  @ApiResponse({ status: 200, description: 'Metrics count' })
  getMetricsCount() {
    return this.metricsService.getMetricsCount();
  }
}
