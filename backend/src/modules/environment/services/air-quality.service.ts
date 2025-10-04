import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AirQuality, AirQualityDocument } from '../schemas/air-quality.schema';
import { CacheService } from './cache.service';

@Injectable()
export class AirQualityService {
  private readonly logger = new Logger(AirQualityService.name);

  constructor(
    @InjectModel(AirQuality.name)
    private airQualityModel: Model<AirQualityDocument>,
    private cacheService: CacheService,
  ) {}

  async getLatestByCity(city: string): Promise<AirQuality> {
    // Try cache first
    const cached = await this.cacheService.get<AirQuality>(`air_quality:${city}`);
    if (cached) {
      this.logger.debug(`Cache hit for air quality: ${city}`);
      return cached;
    }

    // Query database
    const data = await this.airQualityModel
      .findOne({ city: new RegExp(`^${city}$`, 'i') })
      .sort({ timestamp: -1 })
      .exec();

    if (!data) {
      throw new NotFoundException(`Air quality data not found for city: ${city}`);
    }

    // Cache the result
    await this.cacheService.set(`air_quality:${city}`, data.toObject(), 3600);

    return data;
  }

  async getAllLatest(): Promise<AirQuality[]> {
    // Get unique cities with their latest data
    const cities = await this.airQualityModel.distinct('city');

    const latestData = await Promise.all(
      cities.map(async (city) => {
        try {
          return await this.getLatestByCity(city);
        } catch (error) {
          this.logger.warn(`Could not get data for ${city}`);
          return null;
        }
      }),
    );

    return latestData.filter((data) => data !== null);
  }

  async getCityList(): Promise<{ name: string; country: string; coordinates: any }[]> {
    const data = await this.airQualityModel
      .find()
      .select('city country coordinates')
      .sort({ city: 1 });

    // Get unique cities
    const uniqueCities = new Map();
    data.forEach((item) => {
      if (!uniqueCities.has(item.city)) {
        uniqueCities.set(item.city, {
          name: item.city,
          country: item.country,
          coordinates: item.coordinates,
        });
      }
    });

    return Array.from(uniqueCities.values());
  }

  async getHistoricalData(
    city: string,
    from?: Date,
    to?: Date,
  ): Promise<AirQuality[]> {
    const query: any = { city: new RegExp(`^${city}$`, 'i') };

    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = from;
      if (to) query.timestamp.$lte = to;
    }

    return await this.airQualityModel.find(query).sort({ timestamp: -1 }).limit(100).exec();
  }
}
