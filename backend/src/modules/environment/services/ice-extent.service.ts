import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IceExtent, IceExtentDocument } from '../schemas/ice-extent.schema';
import { CacheService } from './cache.service';
import { NsidcService } from './nsidc.service';

@Injectable()
export class IceExtentService {
  private readonly logger = new Logger(IceExtentService.name);
  private readonly cachePrefix = 'ice-extent';
  private readonly cacheTTL = 86400; // 24 hours (daily data updates)

  constructor(
    @InjectModel(IceExtent.name)
    private iceExtentModel: Model<IceExtentDocument>,
    private readonly cacheService: CacheService,
    private readonly nsidcService: NsidcService,
  ) {}

  /**
   * Get latest ice extent data for one or both regions
   */
  async getLatestExtent(region?: string): Promise<IceExtentDocument[]> {
    const cacheKey = `${this.cachePrefix}:latest:${region || 'all'}`;
    const cached = await this.cacheService.get<IceExtentDocument[]>(cacheKey);

    if (cached) {
      this.logger.log(`Cache hit for latest extent (${region || 'all'})`);
      return cached;
    }

    const query = region ? { region } : {};
    
    // Get the latest date for each region
    const pipeline: any[] = [
      ...(region ? [{ $match: { region } }] : []),
      { $sort: { date: -1 } },
      {
        $group: {
          _id: '$region',
          latestData: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$latestData' } },
    ];

    const data = await this.iceExtentModel.aggregate(pipeline).exec();

    if (data.length === 0) {
      throw new NotFoundException(
        `No ice extent data found${region ? ` for ${region}` : ''}`,
      );
    }

    await this.cacheService.set(cacheKey, data, this.cacheTTL);
    return data;
  }

  /**
   * Get historical ice extent data with filters
   */
  async getHistoricalData(
    region: string,
    from: Date,
    to: Date,
  ): Promise<{ count: number; data: IceExtentDocument[] }> {
    this.logger.log(`Fetching historical data for ${region} from ${from.toISOString()} to ${to.toISOString()}`);

    const data = await this.iceExtentModel
      .find({
        region,
        date: { $gte: from, $lte: to },
      })
      .sort({ date: -1 })
      .limit(365) // Max 1 year of daily data
      .exec();

    return {
      count: data.length,
      data,
    };
  }

  /**
   * Get 30-day trend analysis for a region
   */
  async getTrendAnalysis(region?: string): Promise<any> {
    const cacheKey = `${this.cachePrefix}:trend:${region || 'all'}`;
    const cached = await this.cacheService.get<any>(cacheKey);

    if (cached) {
      this.logger.log(`Cache hit for trend analysis (${region || 'all'})`);
      return cached;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const match = region ? { region, date: { $gte: thirtyDaysAgo } } : { date: { $gte: thirtyDaysAgo } };

    const pipeline: any[] = [
      { $match: match },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: '$region',
          currentExtent: { $first: '$extent' },
          currentDate: { $first: '$date' },
          oldestExtent: { $last: '$extent' },
          oldestDate: { $last: '$date' },
          avgExtent: { $avg: '$extent' },
          minExtent: { $min: '$extent' },
          maxExtent: { $max: '$extent' },
          dataPoints: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          region: '$_id',
          currentExtent: 1,
          currentDate: 1,
          oldestExtent: 1,
          oldestDate: 1,
          avgExtent: { $round: ['$avgExtent', 3] },
          minExtent: 1,
          maxExtent: 1,
          dataPoints: 1,
          extentChange: { 
            $round: [
              { $subtract: ['$currentExtent', '$oldestExtent'] },
              3
            ]
          },
          trend: {
            $cond: {
              if: { $gt: [{ $subtract: ['$currentExtent', '$oldestExtent'] }, 0.1] },
              then: 'increasing',
              else: {
                $cond: {
                  if: { $lt: [{ $subtract: ['$currentExtent', '$oldestExtent'] }, -0.1] },
                  then: 'decreasing',
                  else: 'stable',
                },
              },
            },
          },
        },
      },
    ];

    const trends = await this.iceExtentModel.aggregate(pipeline).exec();

    const result = {
      period: '30 days',
      timestamp: new Date(),
      trends: trends || [],
      dataAvailable: trends.length > 0,
    };

    await this.cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  /**
   * Compare Arctic vs Antarctic side-by-side
   */
  async getComparison(): Promise<any> {
    const cacheKey = `${this.cachePrefix}:comparison`;
    const cached = await this.cacheService.get<any>(cacheKey);

    if (cached) {
      this.logger.log('Cache hit for Arctic vs Antarctic comparison');
      return cached;
    }

    const [arctic, antarctic] = await Promise.all([
      this.getLatestExtent('Arctic'),
      this.getLatestExtent('Antarctic'),
    ]);

    const arcticData = arctic[0];
    const antarcticData = antarctic[0];

    const result = {
      timestamp: new Date(),
      arctic: {
        region: arcticData?.region,
        hemisphere: arcticData?.hemisphere,
        extent: arcticData?.extent,
        date: arcticData?.date,
        missing: arcticData?.missing,
      },
      antarctic: {
        region: antarcticData?.region,
        hemisphere: antarcticData?.hemisphere,
        extent: antarcticData?.extent,
        date: antarcticData?.date,
        missing: antarcticData?.missing,
      },
      difference: {
        extent: antarcticData && arcticData
          ? Math.round((antarcticData.extent - arcticData.extent) * 1000) / 1000
          : null,
        percentDifference: antarcticData && arcticData
          ? Math.round(((antarcticData.extent - arcticData.extent) / arcticData.extent) * 10000) / 100
          : null,
      },
    };

    await this.cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  /**
   * Get overall statistics
   */
  async getStatistics(): Promise<any> {
    const cacheKey = `${this.cachePrefix}:statistics`;
    const cached = await this.cacheService.get<any>(cacheKey);

    if (cached) {
      this.logger.log('Cache hit for statistics');
      return cached;
    }

    const [totalCount, arcticCount, antarcticCount, latestData] = await Promise.all([
      this.iceExtentModel.countDocuments().exec(),
      this.iceExtentModel.countDocuments({ region: 'Arctic' }).exec(),
      this.iceExtentModel.countDocuments({ region: 'Antarctic' }).exec(),
      this.iceExtentModel.find().sort({ date: -1 }).limit(2).exec(),
    ]);

    const result = {
      totalReadings: totalCount,
      arcticReadings: arcticCount,
      antarcticReadings: antarcticCount,
      latestUpdate: latestData[0]?.date || null,
      timestamp: new Date(),
    };

    await this.cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  /**
   * Save ice extent data in bulk
   */
  async saveIceExtentsBulk(
    iceExtents: Array<{
      region: string;
      hemisphere: string;
      date: Date;
      extent: number;
      missing: number;
      source: string;
    }>,
  ): Promise<{ saved: number; total: number }> {
    if (iceExtents.length === 0) {
      return { saved: 0, total: 0 };
    }

    try {
      const docs = iceExtents.map((ie) => ({
        ...ie,
        dataSource: 'NSIDC',
      }));

      const result = await this.iceExtentModel.insertMany(docs, {
        ordered: false, // Continue on duplicate key errors
      });

      // Invalidate relevant caches
      await this.invalidateCaches();

      this.logger.log(`Saved ${result.length} ice extent readings`);
      return { saved: result.length, total: iceExtents.length };
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error - some records already exist
        const saved = error.result?.nInserted || 0;
        this.logger.warn(`Inserted ${saved} new readings, skipped duplicates`);
        await this.invalidateCaches();
        return { saved, total: iceExtents.length };
      }
      throw error;
    }
  }

  /**
   * Invalidate all ice extent caches
   */
  private async invalidateCaches(): Promise<void> {
    const keys = [
      `${this.cachePrefix}:latest:all`,
      `${this.cachePrefix}:latest:Arctic`,
      `${this.cachePrefix}:latest:Antarctic`,
      `${this.cachePrefix}:trend:all`,
      `${this.cachePrefix}:trend:Arctic`,
      `${this.cachePrefix}:trend:Antarctic`,
      `${this.cachePrefix}:comparison`,
      `${this.cachePrefix}:statistics`,
    ];

    await Promise.all(keys.map((key) => this.cacheService.del(key)));
    this.logger.log('Invalidated ice extent caches');
  }
}
