import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SeaLevel, SeaLevelDocument } from '../schemas/sea-level.schema';
import { CacheService } from './cache.service';
import { NoaaService } from './noaa.service';

@Injectable()
export class SeaLevelService {
  private readonly logger = new Logger(SeaLevelService.name);
  private readonly cachePrefix = 'sea-level';
  private readonly cacheTTL = 3600; // 1 hour (matches collection frequency)

  constructor(
    @InjectModel(SeaLevel.name)
    private seaLevelModel: Model<SeaLevelDocument>,
    private readonly cacheService: CacheService,
    private readonly noaaService: NoaaService,
  ) {}

  /**
   * Get all available stations
   */
  async getAllStations(): Promise<any[]> {
    const cacheKey = `${this.cachePrefix}:stations`;
    const cached = await this.cacheService.get<any[]>(cacheKey);

    if (cached) {
      this.logger.debug('Returning cached stations list');
      return cached;
    }

    const stations = this.noaaService.getAllStations();
    
    // Get latest data for each station from DB
    const stationsWithData = await Promise.all(
      stations.map(async (station) => {
        const latest = await this.seaLevelModel
          .findOne({ stationId: station.id })
          .sort({ timestamp: -1 })
          .lean()
          .exec();

        return {
          stationId: station.id,
          name: station.name,
          coordinates: { lat: station.lat, lon: station.lon },
          latestReading: latest?.waterLevel,
          lastUpdate: latest?.timestamp,
        };
      }),
    );

    await this.cacheService.set(cacheKey, stationsWithData, this.cacheTTL);
    return stationsWithData;
  }

  /**
   * Get latest reading for a specific station
   */
  async getStationLatest(stationId: string): Promise<SeaLevel> {
    const cacheKey = `${this.cachePrefix}:latest:${stationId}`;
    const cached = await this.cacheService.get<SeaLevel>(cacheKey);

    if (cached) {
      this.logger.debug(`Returning cached data for station ${stationId}`);
      return cached;
    }

    const latest = await this.seaLevelModel
      .findOne({ stationId })
      .sort({ timestamp: -1 })
      .lean()
      .exec();

    if (!latest) {
      throw new NotFoundException(`No data found for station ${stationId}`);
    }

    await this.cacheService.set(cacheKey, latest, this.cacheTTL);
    return latest;
  }

  /**
   * Get historical data for a station
   */
  async getStationHistory(
    stationId: string,
    from: Date,
    to: Date,
    quality?: string,
  ): Promise<{ count: number; data: SeaLevel[] }> {
    this.logger.log(
      `Fetching history for station ${stationId} from ${from} to ${to}`,
    );

    const query: any = {
      stationId,
      timestamp: { $gte: from, $lte: to },
    };

    if (quality) {
      query.quality = quality;
    }

    const data = await this.seaLevelModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(1000) // Limit for performance
      .lean()
      .exec();

    return {
      count: data.length,
      data,
    };
  }

  /**
   * Get data optimized for map visualization
   */
  async getSeaLevelMap(): Promise<{ count: number; data: any[] }> {
    const cacheKey = `${this.cachePrefix}:map`;
    const cached = await this.cacheService.get<{ count: number; data: any[] }>(cacheKey);

    if (cached) {
      this.logger.debug('Returning cached map data');
      return cached;
    }

    const stations = this.noaaService.getAllStations();
    
    const mapData = await Promise.all(
      stations.map(async (station) => {
        const latest = await this.seaLevelModel
          .findOne({ stationId: station.id })
          .sort({ timestamp: -1 })
          .select('stationId stationName waterLevel quality timestamp coordinates')
          .lean()
          .exec();

        if (!latest) return null;

        return {
          stationId: latest.stationId,
          name: latest.stationName,
          lat: latest.coordinates[1], // latitude is second in GeoJSON
          lon: latest.coordinates[0], // longitude is first in GeoJSON
          waterLevel: latest.waterLevel,
          quality: latest.quality,
          timestamp: latest.timestamp,
        };
      }),
    );

    const result = {
      count: mapData.filter((d) => d !== null).length,
      data: mapData.filter((d) => d !== null),
    };

    await this.cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  /**
   * Get global trend statistics
   */
  async getGlobalTrend(): Promise<any> {
    const cacheKey = `${this.cachePrefix}:trend`;
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      this.logger.debug('Returning cached trend data');
      return cached;
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentReadings = await this.seaLevelModel
      .find({ timestamp: { $gte: oneDayAgo } })
      .select('stationId waterLevel timestamp')
      .lean()
      .exec();

    // Calculate statistics
    const stationStats = new Map<string, { readings: number[]; latest: number }>();
    
    recentReadings.forEach((reading) => {
      if (!stationStats.has(reading.stationId)) {
        stationStats.set(reading.stationId, { readings: [], latest: 0 });
      }
      const stats = stationStats.get(reading.stationId)!;
      stats.readings.push(reading.waterLevel);
      stats.latest = reading.waterLevel;
    });

    const trends = Array.from(stationStats.entries()).map(([stationId, stats]) => {
      const avg = stats.readings.reduce((a, b) => a + b, 0) / stats.readings.length;
      const trend = stats.latest - avg;
      
      return {
        stationId,
        current: stats.latest,
        average24h: avg,
        trend: trend > 0 ? 'rising' : trend < 0 ? 'falling' : 'stable',
        change: trend,
      };
    });

    const result = {
      totalStations: stationStats.size,
      totalReadings: recentReadings.length,
      trends,
      timestamp: new Date(),
    };

    await this.cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  /**
   * Save sea level data in bulk
   */
  async saveSeaLevelsBulk(seaLevels: any[]): Promise<number> {
    if (seaLevels.length === 0) {
      return 0;
    }

    try {
      const result = await this.seaLevelModel.insertMany(seaLevels, {
        ordered: false, // Continue on duplicate key errors
      });

      this.logger.log(`Saved ${result.length} sea level readings to database`);
      
      // Invalidate related caches
      await this.invalidateCaches();
      
      return result.length;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key errors
        const inserted = error.result?.nInserted || 0;
        this.logger.warn(
          `Inserted ${inserted} records, ${seaLevels.length - inserted} duplicates skipped`,
        );
        return inserted;
      }
      throw error;
    }
  }

  /**
   * Invalidate all sea level caches
   */
  private async invalidateCaches(): Promise<void> {
    const patterns = [
      `${this.cachePrefix}:stations`,
      `${this.cachePrefix}:map`,
      `${this.cachePrefix}:trend`,
      `${this.cachePrefix}:latest:*`,
    ];

    for (const pattern of patterns) {
      await this.cacheService.del(pattern);
    }
  }

  /**
   * Get statistics for all stations
   */
  async getStatistics(): Promise<any> {
    const cacheKey = `${this.cachePrefix}:statistics`;
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      return cached;
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalReadings, recentReadings, stationCount] = await Promise.all([
      this.seaLevelModel.countDocuments(),
      this.seaLevelModel.countDocuments({ timestamp: { $gte: oneDayAgo } }),
      this.seaLevelModel.distinct('stationId').then((ids) => ids.length),
    ]);

    const result = {
      totalReadings,
      recentReadings,
      activeStations: stationCount,
      last24Hours: recentReadings,
      timestamp: new Date(),
    };

    await this.cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }
}
