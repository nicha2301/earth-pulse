import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Temperature, TemperatureDocument } from '../schemas/temperature.schema';
import { CacheService } from './cache.service';

@Injectable()
export class TemperatureService {
  private readonly logger = new Logger(TemperatureService.name);

  constructor(
    @InjectModel(Temperature.name)
    private temperatureModel: Model<TemperatureDocument>,
    private cacheService: CacheService,
  ) {}

  async getLatestByLocation(location: string): Promise<Temperature> {
    // Try cache first
    const cached = await this.cacheService.get<Temperature>(`temperature:${location}`);
    if (cached) {
      this.logger.debug(`Cache hit for temperature: ${location}`);
      return cached;
    }

    // Query database
    const data = await this.temperatureModel
      .findOne({ location: new RegExp(`^${location}$`, 'i') })
      .sort({ timestamp: -1 })
      .exec();

    if (!data) {
      throw new NotFoundException(`Temperature data not found for location: ${location}`);
    }

    // Cache the result
    await this.cacheService.set(`temperature:${location}`, data.toObject(), 3600);

    return data;
  }

  async getAllLatest(): Promise<Temperature[]> {
    // Get unique locations with their latest data
    const locations = await this.temperatureModel.distinct('location');

    const latestData = await Promise.all(
      locations.map(async (location) => {
        try {
          return await this.getLatestByLocation(location);
        } catch (error) {
          this.logger.warn(`Could not get data for ${location}`);
          return null;
        }
      }),
    );

    return latestData.filter((data) => data !== null);
  }

  async getLocationList(): Promise<{ name: string; country: string; coordinates: any }[]> {
    const data = await this.temperatureModel
      .find()
      .select('location country coordinates')
      .sort({ location: 1 });

    // Get unique locations
    const uniqueLocations = new Map();
    data.forEach((item) => {
      if (!uniqueLocations.has(item.location)) {
        uniqueLocations.set(item.location, {
          name: item.location,
          country: item.country,
          coordinates: item.coordinates,
        });
      }
    });

    return Array.from(uniqueLocations.values());
  }

  async getHistoricalData(
    location: string,
    from?: Date,
    to?: Date,
  ): Promise<Temperature[]> {
    const query: any = { location: new RegExp(`^${location}$`, 'i') };

    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = from;
      if (to) query.timestamp.$lte = to;
    }

    return await this.temperatureModel.find(query).sort({ timestamp: -1 }).limit(100).exec();
  }

  async getGlobalAverage(): Promise<number> {
    const result = await this.temperatureModel.aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$location',
          latestTemp: { $first: '$temperature' },
        },
      },
      {
        $group: {
          _id: null,
          avgTemp: { $avg: '$latestTemp' },
        },
      },
    ]);

    return result.length > 0 ? Math.round(result[0].avgTemp * 10) / 10 : 0;
  }
}
