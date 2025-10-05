import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ForestFire, ForestFireDocument } from '../schemas/forest-fire.schema';
import { CacheService } from './cache.service';

@Injectable()
export class ForestFireService {
  private readonly logger = new Logger(ForestFireService.name);
  private readonly cachePrefix = 'forest-fire';
  private readonly cacheTTL = 10800; // 3 hours

  constructor(
    @InjectModel(ForestFire.name)
    private forestFireModel: Model<ForestFireDocument>,
    private cacheService: CacheService,
  ) {}

  /**
   * Get all active fires (last 24 hours)
   */
  async getActiveFires(): Promise<ForestFire[]> {
    const cacheKey = `${this.cachePrefix}:active`;

    // Try cache first
    const cached = await this.cacheService.get<ForestFire[]>(cacheKey);
    if (cached) {
      this.logger.log('Returning active fires from cache');
      return cached;
    }

    // Get fires from last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const fires = await this.forestFireModel
      .find({
        timestamp: { $gte: yesterday },
      })
      .sort({ timestamp: -1 })
      .lean()
      .exec();

    // Cache result
    await this.cacheService.set(cacheKey, fires, this.cacheTTL);

    this.logger.log(`Found ${fires.length} active fires`);
    return fires;
  }

  /**
   * Get fires for map visualization
   */
  async getFiresForMap(): Promise<any[]> {
    const fires = await this.getActiveFires();

    return fires.map(fire => ({
      latitude: fire.latitude,
      longitude: fire.longitude,
      brightness: fire.brightness,
      confidence: fire.confidence,
      frp: fire.frp,
      timestamp: fire.timestamp,
      satellite: fire.satellite,
    }));
  }

  /**
   * Get fire history with date range
   */
  async getFireHistory(
    from?: Date,
    to?: Date,
    confidence?: string,
  ): Promise<{ count: number; data: ForestFire[] }> {
    const query: any = {};

    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    if (confidence) {
      query.confidence = new RegExp(confidence, 'i');
    }

    const fires = await this.forestFireModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(1000) // Limit to prevent huge responses
      .lean()
      .exec();

    return {
      count: fires.length,
      data: fires,
    };
  }

  /**
   * Get fire statistics
   */
  async getFireStats(): Promise<any> {
    const cacheKey = `${this.cachePrefix}:stats`;

    // Try cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [total, byConfidence, bySatellite] = await Promise.all([
      // Total active fires
      this.forestFireModel.countDocuments({
        timestamp: { $gte: yesterday },
      }),

      // Group by confidence
      this.forestFireModel.aggregate([
        { $match: { timestamp: { $gte: yesterday } } },
        {
          $group: {
            _id: '$confidence',
            count: { $sum: 1 },
            avgFrp: { $avg: '$frp' },
          },
        },
      ]),

      // Group by satellite
      this.forestFireModel.aggregate([
        { $match: { timestamp: { $gte: yesterday } } },
        {
          $group: {
            _id: '$satellite',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats = {
      totalActiveFires: total,
      last24Hours: total,
      byConfidence: byConfidence.reduce((acc, item) => {
        acc[item._id] = {
          count: item.count,
          avgFrp: item.avgFrp.toFixed(2),
        };
        return acc;
      }, {}),
      bySatellite: bySatellite.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      timestamp: new Date(),
    };

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, stats, 3600);

    return stats;
  }

  /**
   * Save fires to database (bulk)
   */
  async saveFiresBulk(fires: any[]): Promise<number> {
    if (fires.length === 0) {
      return 0;
    }

    try {
      // Transform data
      const documents = fires.map(fire => ({
        latitude: fire.latitude,
        longitude: fire.longitude,
        brightness: fire.brightness,
        confidence: fire.confidence,
        frp: fire.frp,
        satellite: fire.satellite,
        instrument: fire.instrument,
        acq_date: fire.acq_date,
        acq_time: fire.acq_time,
        daynight: fire.daynight,
        timestamp: this.parseTimestamp(fire.acq_date, fire.acq_time),
        source: 'NASA FIRMS',
        coordinates: {
          lat: fire.latitude,
          lon: fire.longitude,
        },
      }));

      // Use insertMany with ordered: false to continue on duplicates
      const result = await this.forestFireModel.insertMany(documents, {
        ordered: false,
      });

      this.logger.log(`Saved ${result.length} fires to database`);

      // Invalidate cache
      await this.cacheService.del(`${this.cachePrefix}:active`);
      await this.cacheService.del(`${this.cachePrefix}:stats`);

      return result.length;
    } catch (error) {
      // Handle duplicate key errors
      if (error.code === 11000) {
        this.logger.warn('Some fires already exist in database');
        return error.result?.nInserted || 0;
      }
      throw error;
    }
  }

  /**
   * Parse acquisition date and time to timestamp
   */
  private parseTimestamp(acq_date: string, acq_time: string): Date {
    // acq_date format: YYYY-MM-DD
    // acq_time format: HHMM
    const hour = acq_time.slice(0, 2);
    const minute = acq_time.slice(2, 4);
    return new Date(`${acq_date}T${hour}:${minute}:00Z`);
  }
}
