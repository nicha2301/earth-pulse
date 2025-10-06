import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CleanupService } from '../services/cleanup.service';

/**
 * CleanupController
 * 
 * Provides endpoints to manage data cleanup operations.
 * - Manual trigger for emergency cleanup
 * - View cleanup statistics
 * - Monitor cleanup status
 */
@ApiTags('cleanup')
@Controller('cleanup')
export class CleanupController {
  constructor(private readonly cleanupService: CleanupService) {}

  /**
   * Manually trigger cleanup job
   * 
   * Use this endpoint for:
   * - Testing cleanup logic
   * - Emergency cleanup when database is full
   * - Running cleanup outside of scheduled time
   * 
   * Warning: This may take several minutes depending on data volume
   */
  @Post('trigger')
  @ApiOperation({ 
    summary: 'Manually trigger data cleanup',
    description: 'Runs the cleanup job immediately. May take several minutes.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cleanup completed successfully',
    schema: {
      example: {
        success: true,
        message: 'Cleanup job completed',
        results: {
          airQuality: 1250,
          temperature: 500,
          forestFire: 3500,
          seaLevel: 2000,
          iceExtent: 100,
          total: 7350,
        },
      },
    },
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Cleanup job is already running',
  })
  async triggerCleanup() {
    await this.cleanupService.triggerManualCleanup();
    
    return {
      success: true,
      message: 'Cleanup job completed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cleanup statistics
   * 
   * Shows:
   * - Retention policies for each data type
   * - Number of records pending deletion
   * - Cutoff dates
   * - Whether cleanup is currently running
   */
  @Get('stats')
  @ApiOperation({ 
    summary: 'Get cleanup statistics',
    description: 'View current cleanup status and pending deletions'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cleanup statistics retrieved',
    schema: {
      example: {
        airQuality: {
          retentionDays: 30,
          cutoffDate: '2024-09-06T00:00:00.000Z',
          recordsToDelete: 1250,
        },
        temperature: {
          retentionDays: 60,
          cutoffDate: '2024-08-07T00:00:00.000Z',
          recordsToDelete: 500,
        },
        forestFire: {
          retentionDays: 90,
          cutoffDate: '2024-07-08T00:00:00.000Z',
          recordsToDelete: 3500,
        },
        seaLevel: {
          retentionDays: 180,
          cutoffDate: '2024-04-09T00:00:00.000Z',
          recordsToDelete: 2000,
        },
        iceExtent: {
          retentionDays: 365,
          cutoffDate: '2023-10-06T00:00:00.000Z',
          recordsToDelete: 100,
        },
        isCleanupRunning: false,
      },
    },
  })
  async getCleanupStats() {
    const stats = await this.cleanupService.getCleanupStats();
    
    return {
      ...stats,
      timestamp: new Date().toISOString(),
      totalRecordsToDelete: 
        stats.airQuality.recordsToDelete +
        stats.temperature.recordsToDelete +
        stats.forestFire.recordsToDelete +
        stats.seaLevel.recordsToDelete +
        stats.iceExtent.recordsToDelete,
    };
  }

  /**
   * Get cleanup configuration
   */
  @Get('config')
  @ApiOperation({ 
    summary: 'Get cleanup configuration',
    description: 'View retention policies and cleanup schedule'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cleanup configuration',
  })
  async getCleanupConfig() {
    return {
      retentionPolicies: {
        airQuality: '30 days',
        temperature: '60 days',
        forestFire: '90 days',
        seaLevel: '180 days',
        iceExtent: '365 days',
      },
      cleanupSchedule: {
        cron: '0 2 * * *',
        description: 'Daily at 2:00 AM UTC',
        timezone: 'UTC',
      },
      batchSize: 1000,
      features: [
        'Automatic daily cleanup',
        'Batch deletion to prevent memory issues',
        'Comprehensive logging',
        'Metrics tracking',
        'Error handling with retry logic',
      ],
    };
  }
}
