import {
  Controller,
  Post,
  Get,
  Query,
  Logger,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { HistoricalCollectorService } from '../services/historical-collector.service';

@ApiTags('Historical Data Collector')
@Controller('collector/historical')
export class HistoricalCollectorController {
  private readonly logger = new Logger(HistoricalCollectorController.name);

  constructor(
    private readonly historicalCollectorService: HistoricalCollectorService,
  ) {}

  @Post('ice-extent')
  @ApiOperation({
    summary: 'Collect historical Ice Extent data',
    description:
      'Triggers collection of historical Arctic and Antarctic sea ice extent data from NSIDC. ' +
      'Fetches daily ice extent measurements for the specified number of years. ' +
      'Data goes back to 1979 in NSIDC archives.',
  })
  @ApiQuery({
    name: 'years',
    required: false,
    type: Number,
    description: 'Number of years to collect (default: 5, max: 45)',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Collection initiated successfully',
    schema: {
      example: {
        success: true,
        message: 'Successfully collected 5 years of Ice Extent data',
        details: {
          status: 'completed',
          module: 'Ice Extent',
          startTime: '2025-10-04T10:00:00.000Z',
          endTime: '2025-10-04T10:03:25.000Z',
          totalItems: 3653,
          processedItems: 3653,
          savedItems: 3650,
          duplicateSkipped: 3,
          errors: 0,
          progressPercent: 100,
        },
      },
    },
  })
  async collectIceExtentHistorical(@Query('years') years?: number) {
    this.logger.log(`Received request to collect Ice Extent historical data: ${years || 5} years`);

    const yearsToCollect = Math.min(years || 5, 45); // Cap at 45 years (NSIDC data starts 1979)
    const result = await this.historicalCollectorService.collectIceExtentHistorical(yearsToCollect);

    return {
      ...result,
      timestamp: new Date(),
    };
  }

  @Post('sea-level')
  @ApiOperation({
    summary: 'Collect historical Sea Level data',
    description:
      'Triggers collection of historical water level data from NOAA CO-OPS for 25 coastal stations. ' +
      'Collects verified water level readings in metric units. Processing time: ~20-30 seconds per month for all stations.',
  })
  @ApiQuery({
    name: 'months',
    required: false,
    type: Number,
    description: 'Number of months to collect (default: 24)',
    example: 24,
  })
  @ApiResponse({
    status: 200,
    description: 'Collection status and progress',
    schema: {
      example: {
        success: true,
        message: 'Successfully collected 5,280 sea level records',
        details: {
          status: 'completed',
          totalItems: 5280,
          savedItems: 5100,
          duplicateSkipped: 180,
          errors: 0,
          progressPercent: 100,
        },
        timestamp: '2025-10-04T10:00:00.000Z',
      },
    },
  })
  async collectSeaLevelHistorical(@Query('months') months?: number) {
    this.logger.log(`Received request to collect Sea Level historical data: ${months || 24} months`);

    const monthsToCollect = months || 24;
    const result = await this.historicalCollectorService.collectSeaLevelHistorical(monthsToCollect);

    return {
      ...result,
      timestamp: new Date(),
    };
  }

  @Post('temperature')
  @ApiOperation({
    summary: 'Collect historical Temperature data',
    description:
      'Triggers collection of historical temperature data from Open-Meteo API for 25 major cities. ' +
      'Uses free Open-Meteo Archive API with data back to 1940.',
  })
  @ApiQuery({
    name: 'months',
    required: false,
    type: Number,
    description: 'Number of months to collect (default: 12)',
    example: 12,
  })
  @ApiResponse({
    status: 200,
    description: 'Collection status',
    schema: {
      example: {
        success: true,
        message: 'Successfully collected 12 months of Temperature data',
        timestamp: '2025-10-04T10:00:00.000Z',
      },
    },
  })
  async collectTemperatureHistorical(@Query('months') months?: number) {
    this.logger.log(`Received request to collect Temperature historical data: ${months || 12} months`);

    const monthsToCollect = months || 12;
    const result = await this.historicalCollectorService.collectTemperatureHistorical(monthsToCollect);

    return {
      ...result,
      timestamp: new Date(),
    };
  }

  @Post('forest-fires')
  @ApiOperation({
    summary: 'Collect historical Forest Fire data',
    description:
      'Triggers collection of historical wildfire detection data from NASA FIRMS. ' +
      'IMPORTANT: NASA FIRMS standard API only provides last 10 days of data. ' +
      'For older historical data, archive files must be downloaded separately.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to collect (default: 10, max: 10 due to API limitation)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Collection initiated successfully',
    schema: {
      example: {
        success: true,
        message: 'Successfully collected 10 days of Forest Fire data (API limit: max 10 days)',
        details: {
          status: 'completed',
          module: 'Forest Fire',
          startTime: '2025-10-04T10:00:00.000Z',
          endTime: '2025-10-04T10:05:00.000Z',
          totalItems: 15234,
          processedItems: 15234,
          savedItems: 15200,
          duplicateSkipped: 34,
          errors: 0,
          progressPercent: 100,
        },
        timestamp: '2025-10-04T10:05:00.000Z',
      },
    },
  })
  async collectForestFireHistorical(@Query('days') days?: number) {
    this.logger.log(`Received request to collect Forest Fire historical data: ${days || 10} days`);

    const daysToCollect = days || 10;
    const result = await this.historicalCollectorService.collectForestFireHistorical(daysToCollect);

    return {
      ...result,
      timestamp: new Date(),
    };
  }

  @Post('archive/forest-fires')
  @ApiOperation({
    summary: 'Collect Forest Fire Archive Data (2000-2024)',
    description:
      'Downloads and imports historical wildfire detection data from NASA FIRMS archive. ' +
      'Data is downloaded in 10-day chunks and processed with duplicate detection. ' +
      'MODIS: 2000-present (1km resolution), VIIRS: 2012-present (375m resolution). ' +
      'Warning: Large date ranges take hours to process (e.g., 24 years = ~15-20 hours).',
  })
  @ApiQuery({
    name: 'startYear',
    required: false,
    type: Number,
    description: 'Start year (MODIS: 2000+, VIIRS: 2012+)',
    example: 2023,
  })
  @ApiQuery({
    name: 'endYear',
    required: false,
    type: Number,
    description: 'End year (default: current year)',
    example: 2024,
  })
  @ApiQuery({
    name: 'source',
    required: false,
    type: String,
    description: 'Satellite source (MODIS_NRT, VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, VIIRS_NOAA21_NRT)',
    example: 'MODIS_NRT',
  })
  @ApiResponse({
    status: 200,
    description: 'Archive collection initiated',
    schema: {
      example: {
        success: true,
        message: 'Successfully collected 2023-2024 archive data',
        details: {
          status: 'completed',
          module: 'Forest Fire Archive (2023-2024)',
          startTime: '2025-10-04T10:00:00.000Z',
          endTime: '2025-10-04T10:45:00.000Z',
          totalItems: 1850000,
          processedItems: 1850000,
          savedItems: 1845000,
          duplicateSkipped: 5000,
          errors: 0,
          progressPercent: 100,
        },
        timestamp: '2025-10-04T10:45:00.000Z',
      },
    },
  })
  async collectForestFireArchive(
    @Query('startYear') startYear?: number,
    @Query('endYear') endYear?: number,
    @Query('source') source?: string,
  ) {
    // Default to last 2 years if not specified
    const currentYear = new Date().getFullYear();
    const start = startYear || currentYear - 1;
    const end = endYear || currentYear;
    const src = source || 'MODIS_NRT';

    // Validate year range
    if (start > end) {
      return {
        success: false,
        message: 'Start year must be less than or equal to end year',
        timestamp: new Date(),
      };
    }

    // Validate satellite availability
    const satelliteInfo: Record<string, number> = {
      MODIS_NRT: 2000,
      VIIRS_SNPP_NRT: 2012,
      VIIRS_NOAA20_NRT: 2018,
      VIIRS_NOAA21_NRT: 2024,
    };

    const minYear = satelliteInfo[src];
    if (minYear && start < minYear) {
      return {
        success: false,
        message: `${src} data only available from ${minYear} onwards. Please adjust start year or choose MODIS_NRT for earlier data.`,
        timestamp: new Date(),
      };
    }

    this.logger.log(`Archive collection request: ${start}-${end}, source: ${src}`);

    const result = await this.historicalCollectorService.collectForestFireArchive(
      start,
      end,
      src,
    );

    return {
      ...result,
      timestamp: new Date(),
    };
  }

  @Post('bulk-import/forest-fires')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk Import Forest Fire Data from CSV File',
    description:
      'Upload a CSV file downloaded from NASA FIRMS archive to import historical wildfire data. ' +
      'Supports large files (millions of records) with efficient chunked processing. ' +
      'Duplicate detection is performed based on location and timestamp. ' +
      'File must be in FIRMS CSV format with required columns: latitude, longitude, brightness, acq_date, acq_time, satellite.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file downloaded from NASA FIRMS archive',
        },
        source: {
          type: 'string',
          description: 'Satellite source (MODIS_NRT, VIIRS_SNPP_NRT, etc.)',
          example: 'MODIS_NRT',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Import completed',
    schema: {
      example: {
        success: true,
        message: 'Successfully imported 1,850,000 fire records',
        details: {
          status: 'completed',
          module: 'Forest Fire Bulk Import',
          startTime: '2025-10-04T12:00:00.000Z',
          endTime: '2025-10-04T12:25:00.000Z',
          totalItems: 1850000,
          processedItems: 1850000,
          savedItems: 1845000,
          duplicateSkipped: 5000,
          errors: 0,
          progressPercent: 100,
        },
        timestamp: '2025-10-04T12:25:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or missing file',
  })
  async bulkImportForestFires(
    @UploadedFile() file: any,
    @Query('source') source?: string,
  ) {
    if (!file) {
      return {
        success: false,
        message: 'No file uploaded. Please upload a CSV file.',
        timestamp: new Date(),
      };
    }

    // Validate file type
    if (!file.originalname.endsWith('.csv')) {
      return {
        success: false,
        message: 'Invalid file type. Only CSV files are supported.',
        timestamp: new Date(),
      };
    }

    this.logger.log(
      `Bulk import request: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
    );

    const src = source || 'MODIS_NRT';
    const result = await this.historicalCollectorService.bulkImportForestFires(
      file.buffer,
      src,
    );

    return {
      ...result,
      timestamp: new Date(),
    };
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get collection progress status',
    description:
      'Returns the progress status of all active historical data collection tasks. ' +
      'Shows real-time progress including processed items, saved items, duplicates skipped, and errors.',
  })
  @ApiResponse({
    status: 200,
    description: 'Collection progress status',
    schema: {
      example: {
        activeTasks: [
          {
            status: 'running',
            module: 'Ice Extent',
            startTime: '2025-10-04T10:00:00.000Z',
            totalItems: 3653,
            processedItems: 1500,
            savedItems: 1497,
            duplicateSkipped: 3,
            errors: 0,
            progressPercent: 41,
          },
        ],
        timestamp: '2025-10-04T10:01:30.000Z',
      },
    },
  })
  async getCollectionStatus() {
    const progress = this.historicalCollectorService.getAllProgress();

    return {
      activeTasks: progress,
      totalActiveTasks: progress.length,
      timestamp: new Date(),
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get collection statistics',
    description:
      'Returns comprehensive statistics about collected historical data including ' +
      'total records, date ranges, and estimated coverage for each data type.',
  })
  @ApiResponse({
    status: 200,
    description: 'Collection statistics',
    schema: {
      example: {
        iceExtent: {
          totalRecords: 3650,
          dateRange: {
            oldest: '2020-10-04T00:00:00.000Z',
            newest: '2025-10-04T00:00:00.000Z',
          },
          estimatedYears: '5.0',
        },
        seaLevel: {
          totalRecords: 13140,
          dateRange: {
            oldest: '2023-10-04T00:00:00.000Z',
            newest: '2025-10-04T00:00:00.000Z',
          },
          estimatedMonths: '24.0',
        },
        temperature: {
          totalRecords: 2628,
          dateRange: {
            oldest: '2024-10-04T00:00:00.000Z',
            newest: '2025-10-04T00:00:00.000Z',
          },
          estimatedMonths: '12.0',
        },
      },
    },
  })
  async getCollectionStats() {
    const stats = await this.historicalCollectorService.getCollectionStats();
    return stats;
  }

  @Get('estimates')
  @ApiOperation({
    summary: 'Get estimated collection times',
    description:
      'Returns estimated time requirements for collecting historical data. ' +
      'Useful for planning data collection tasks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estimated collection times',
    schema: {
      example: {
        iceExtent: {
          perYear: '~30-60 seconds',
          fiveYears: '~3-5 minutes',
          tenYears: '~5-10 minutes',
        },
        seaLevel: {
          perMonth: '~20-30 seconds (25 stations)',
          sixMonths: '~2-3 minutes',
          twoYears: '~8-12 minutes',
        },
        temperature: {
          perMonth: '~15-25 seconds (15 cities)',
          sixMonths: '~2-3 minutes',
          oneYear: '~4-6 minutes',
        },
      },
    },
  })
  async getEstimatedTimes() {
    const estimates = this.historicalCollectorService.getEstimatedTimes();
    return {
      ...estimates,
      note: 'Actual times may vary based on API response times and network conditions',
      timestamp: new Date(),
    };
  }
}
