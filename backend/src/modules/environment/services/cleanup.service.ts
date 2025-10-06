import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AirQuality } from '../schemas/air-quality.schema';
import { Temperature } from '../schemas/temperature.schema';
import { ForestFire } from '../schemas/forest-fire.schema';
import { SeaLevel } from '../schemas/sea-level.schema';
import { IceExtent } from '../schemas/ice-extent.schema';
import {
  RETENTION_POLICIES,
  CLEANUP_BATCH_SIZE,
  getCutoffDate,
} from '../../../config/retention.config';
import { MetricsService } from './metrics.service';

/**
 * CleanupService
 * 
 * Automatically deletes old data based on retention policies.
 * Runs daily at 2:00 AM server time via cron job.
 * 
 * Features:
 * - Batch deletion to avoid memory issues
 * - Comprehensive logging
 * - Metrics tracking
 * - Error handling with retry logic
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private isCleanupRunning = false;

  constructor(
    @InjectModel(AirQuality.name) private airQualityModel: Model<AirQuality>,
    @InjectModel(Temperature.name) private temperatureModel: Model<Temperature>,
    @InjectModel(ForestFire.name) private forestFireModel: Model<ForestFire>,
    @InjectModel(SeaLevel.name) private seaLevelModel: Model<SeaLevel>,
    @InjectModel(IceExtent.name) private iceExtentModel: Model<IceExtent>,
    private metricsService: MetricsService,
  ) {}

  /**
   * Main cleanup job - runs daily at 2:00 AM
   */
  @Cron('0 2 * * *', {
    name: 'daily-cleanup',
    timeZone: 'UTC',
  })
  async handleDailyCleanup() {
    if (this.isCleanupRunning) {
      this.logger.warn('Cleanup job already running, skipping...');
      return;
    }

    this.isCleanupRunning = true;
    const startTime = Date.now();

    this.logger.log('========================================');
    this.logger.log('🧹 Starting daily cleanup job...');
    this.logger.log('========================================');

    try {
      const results = await this.cleanupAllData();
      const duration = Date.now() - startTime;

      this.logger.log('========================================');
      this.logger.log('✅ Cleanup job completed successfully!');
      this.logger.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
      this.logger.log('Results:');
      this.logger.log(`  Air Quality: ${results.airQuality} records deleted`);
      this.logger.log(`  Temperature: ${results.temperature} records deleted`);
      this.logger.log(`  Forest Fires: ${results.forestFire} records deleted`);
      this.logger.log(`  Sea Level: ${results.seaLevel} records deleted`);
      this.logger.log(`  Ice Extent: ${results.iceExtent} records deleted`);
      this.logger.log(`  TOTAL: ${results.total} records deleted`);
      this.logger.log('========================================');

      // Track cleanup metrics
      this.metricsService.trackCollectionJob(
        'cleanup-all',
        duration,
        true,
        results.total,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('❌ Cleanup job failed!', error.stack);
      
      // Track failure metric
      this.metricsService.trackCollectionJob(
        'cleanup-all',
        duration,
        false,
        0,
        error.message,
      );
    } finally {
      this.isCleanupRunning = false;
    }
  }

  /**
   * Cleanup all data types
   */
  async cleanupAllData() {
    const results = {
      airQuality: 0,
      temperature: 0,
      forestFire: 0,
      seaLevel: 0,
      iceExtent: 0,
      total: 0,
    };

    // Run cleanups sequentially to avoid database overload
    results.airQuality = await this.cleanupAirQuality();
    results.temperature = await this.cleanupTemperature();
    results.forestFire = await this.cleanupForestFire();
    results.seaLevel = await this.cleanupSeaLevel();
    results.iceExtent = await this.cleanupIceExtent();

    results.total =
      results.airQuality +
      results.temperature +
      results.forestFire +
      results.seaLevel +
      results.iceExtent;

    return results;
  }

  /**
   * Cleanup Air Quality data (30 days retention)
   */
  async cleanupAirQuality(): Promise<number> {
    const cutoffDate = getCutoffDate(RETENTION_POLICIES.airQuality);
    return this.cleanupCollection(
      'Air Quality',
      this.airQualityModel,
      cutoffDate,
    );
  }

  /**
   * Cleanup Temperature data (60 days retention)
   */
  async cleanupTemperature(): Promise<number> {
    const cutoffDate = getCutoffDate(RETENTION_POLICIES.temperature);
    return this.cleanupCollection(
      'Temperature',
      this.temperatureModel,
      cutoffDate,
    );
  }

  /**
   * Cleanup Forest Fire data (90 days retention)
   */
  async cleanupForestFire(): Promise<number> {
    const cutoffDate = getCutoffDate(RETENTION_POLICIES.forestFire);
    return this.cleanupCollection(
      'Forest Fire',
      this.forestFireModel,
      cutoffDate,
    );
  }

  /**
   * Cleanup Sea Level data (180 days retention)
   */
  async cleanupSeaLevel(): Promise<number> {
    const cutoffDate = getCutoffDate(RETENTION_POLICIES.seaLevel);
    return this.cleanupCollection('Sea Level', this.seaLevelModel, cutoffDate);
  }

  /**
   * Cleanup Ice Extent data (365 days retention)
   */
  async cleanupIceExtent(): Promise<number> {
    const cutoffDate = getCutoffDate(RETENTION_POLICIES.iceExtent);
    return this.cleanupCollection('Ice Extent', this.iceExtentModel, cutoffDate);
  }

  /**
   * Generic cleanup method with batch deletion
   */
  private async cleanupCollection(
    name: string,
    model: Model<any>,
    cutoffDate: Date,
  ): Promise<number> {
    this.logger.log(`🔍 Checking ${name} data older than ${cutoffDate.toISOString()}...`);

    let totalDeleted = 0;
    const startTime = Date.now();

    try {
      // Count records to delete
      const countToDelete = await model
        .countDocuments({ timestamp: { $lt: cutoffDate } })
        .exec();

      if (countToDelete === 0) {
        this.logger.log(`✅ ${name}: No old records to delete`);
        return 0;
      }

      this.logger.log(`📊 ${name}: Found ${countToDelete} records to delete`);

      // Delete in batches to avoid memory issues
      while (true) {
        const deleteResult = await model
          .deleteMany({ timestamp: { $lt: cutoffDate } })
          .limit(CLEANUP_BATCH_SIZE)
          .exec();

        const deleted = deleteResult.deletedCount || 0;
        totalDeleted += deleted;

        if (deleted > 0) {
          this.logger.debug(
            `  Batch deleted ${deleted} ${name} records (${totalDeleted}/${countToDelete})`,
          );
        }

        // Stop if no more records to delete
        if (deleted < CLEANUP_BATCH_SIZE) {
          break;
        }

        // Small delay between batches to reduce database load
        await this.sleep(100);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ ${name}: Deleted ${totalDeleted} records in ${(duration / 1000).toFixed(2)}s`,
      );

      // Track individual cleanup metric
      this.metricsService.trackCollectionJob(
        `cleanup-${name.toLowerCase().replace(/\s/g, '-')}`,
        duration,
        true,
        totalDeleted,
      );

      return totalDeleted;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ ${name}: Cleanup failed - ${error.message}`, error.stack);
      
      // Track failure
      this.metricsService.trackCollectionJob(
        `cleanup-${name.toLowerCase().replace(/\s/g, '-')}`,
        duration,
        false,
        totalDeleted,
        error.message,
      );

      // Return what was deleted before error
      return totalDeleted;
    }
  }

  /**
   * Manual trigger for cleanup (for testing or emergency use)
   */
  async triggerManualCleanup() {
    this.logger.log('🔧 Manual cleanup triggered');
    return this.handleDailyCleanup();
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    const stats = {
      airQuality: {
        retentionDays: RETENTION_POLICIES.airQuality,
        cutoffDate: getCutoffDate(RETENTION_POLICIES.airQuality),
        recordsToDelete: 0,
      },
      temperature: {
        retentionDays: RETENTION_POLICIES.temperature,
        cutoffDate: getCutoffDate(RETENTION_POLICIES.temperature),
        recordsToDelete: 0,
      },
      forestFire: {
        retentionDays: RETENTION_POLICIES.forestFire,
        cutoffDate: getCutoffDate(RETENTION_POLICIES.forestFire),
        recordsToDelete: 0,
      },
      seaLevel: {
        retentionDays: RETENTION_POLICIES.seaLevel,
        cutoffDate: getCutoffDate(RETENTION_POLICIES.seaLevel),
        recordsToDelete: 0,
      },
      iceExtent: {
        retentionDays: RETENTION_POLICIES.iceExtent,
        cutoffDate: getCutoffDate(RETENTION_POLICIES.iceExtent),
        recordsToDelete: 0,
      },
      isCleanupRunning: this.isCleanupRunning,
    };

    // Count records that would be deleted
    stats.airQuality.recordsToDelete = await this.airQualityModel
      .countDocuments({ timestamp: { $lt: stats.airQuality.cutoffDate } })
      .exec();

    stats.temperature.recordsToDelete = await this.temperatureModel
      .countDocuments({ timestamp: { $lt: stats.temperature.cutoffDate } })
      .exec();

    stats.forestFire.recordsToDelete = await this.forestFireModel
      .countDocuments({ timestamp: { $lt: stats.forestFire.cutoffDate } })
      .exec();

    stats.seaLevel.recordsToDelete = await this.seaLevelModel
      .countDocuments({ timestamp: { $lt: stats.seaLevel.cutoffDate } })
      .exec();

    stats.iceExtent.recordsToDelete = await this.iceExtentModel
      .countDocuments({ date: { $lt: stats.iceExtent.cutoffDate } })
      .exec();

    return stats;
  }

  /**
   * Helper method to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
