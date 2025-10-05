import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { IceExtentService } from '../services/ice-extent.service';
import { IceExtentQueryDto } from '../dto/ice-extent.dto';

@ApiTags('Ice Extent')
@Controller('ice-extent')
export class IceExtentController {
  private readonly logger = new Logger(IceExtentController.name);

  constructor(private readonly iceExtentService: IceExtentService) {}

  @Get('latest')
  @ApiOperation({
    summary: 'Get latest ice extent data',
    description:
      'Returns the most recent sea ice extent measurements for Arctic, Antarctic, or both regions. Data is cached for 24 hours.',
  })
  @ApiQuery({
    name: 'region',
    required: false,
    enum: ['Arctic', 'Antarctic'],
    description: 'Filter by region (Arctic or Antarctic). Omit to get both.',
  })
  @ApiResponse({
    status: 200,
    description: 'Latest ice extent data',
  })
  async getLatest(@Query('region') region?: string) {
    this.logger.log(`Getting latest ice extent data${region ? ` for ${region}` : ' for all regions'}`);
    return await this.iceExtentService.getLatestExtent(region);
  }

  @Get('trend')
  @ApiOperation({
    summary: 'Get 30-day trend analysis',
    description:
      'Analyzes ice extent trends over the last 30 days, including average extent, min/max values, and trend direction (increasing/decreasing/stable). Cached for 24 hours.',
  })
  @ApiQuery({
    name: 'region',
    required: false,
    enum: ['Arctic', 'Antarctic'],
    description: 'Filter by region. Omit to get trends for both regions.',
  })
  @ApiResponse({
    status: 200,
    description: '30-day trend analysis',
  })
  async getTrend(@Query('region') region?: string) {
    this.logger.log(`Getting 30-day trend analysis${region ? ` for ${region}` : ' for all regions'}`);
    return await this.iceExtentService.getTrendAnalysis(region);
  }

  @Get('comparison')
  @ApiOperation({
    summary: 'Compare Arctic vs Antarctic',
    description:
      'Side-by-side comparison of latest Arctic and Antarctic sea ice extents, including the absolute and percentage difference. Cached for 24 hours.',
  })
  @ApiResponse({
    status: 200,
    description: 'Arctic vs Antarctic comparison',
  })
  async getComparison() {
    this.logger.log('Getting Arctic vs Antarctic comparison');
    return await this.iceExtentService.getComparison();
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get overall statistics',
    description:
      'Returns overall statistics including total readings count, readings per region, and last update timestamp. Cached for 24 hours.',
  })
  @ApiResponse({
    status: 200,
    description: 'Overall ice extent statistics',
  })
  async getStatistics() {
    this.logger.log('Getting ice extent statistics');
    return await this.iceExtentService.getStatistics();
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get historical ice extent data',
    description:
      'Query historical sea ice extent data for a specific region within a date range. Maximum 365 days of data returned. Not cached.',
  })
  @ApiQuery({
    name: 'region',
    required: true,
    enum: ['Arctic', 'Antarctic'],
    description: 'Region to query (Arctic or Antarctic)',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    type: String,
    description: 'Start date (ISO 8601 format, e.g., 2025-01-01)',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'to',
    required: true,
    type: String,
    description: 'End date (ISO 8601 format, e.g., 2025-10-02)',
    example: '2025-10-02',
  })
  @ApiResponse({
    status: 200,
    description: 'Historical ice extent data within date range',
  })
  async getHistory(@Query() query: IceExtentQueryDto) {
    this.logger.log(
      `Getting historical data for ${query.region} from ${query.from} to ${query.to}`,
    );

    const fromDate = new Date(query.from || '');
    const toDate = new Date(query.to || '');

    return await this.iceExtentService.getHistoricalData(
      query.region || 'Arctic',
      fromDate,
      toDate,
    );
  }
}
