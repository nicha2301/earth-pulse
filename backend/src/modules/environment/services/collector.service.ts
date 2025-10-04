import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AqicnService } from './aqicn.service';
import { OpenWeatherService } from './openweather.service';
import { CacheService } from './cache.service';
import { AirQuality, AirQualityDocument } from '../schemas/air-quality.schema';
import { Temperature, TemperatureDocument } from '../schemas/temperature.schema';

@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);

  constructor(
    @InjectModel(AirQuality.name)
    private airQualityModel: Model<AirQualityDocument>,
    @InjectModel(Temperature.name)
    private temperatureModel: Model<TemperatureDocument>,
    private aqicnService: AqicnService,
    private openWeatherService: OpenWeatherService,
    private cacheService: CacheService,
  ) {}

  // Run every hour (at minute 0)
  @Cron(CronExpression.EVERY_HOUR)
  async collectAirQualityData() {
    this.logger.log('🔄 Starting air quality data collection...');

    const cities = this.aqicnService.getCitiesForCollection();
    let successCount = 0;
    let errorCount = 0;

    for (const city of cities) {
      try {
        const data = await this.aqicnService.getAirQuality(city);

        if (data) {
          // Save to MongoDB
          const airQuality = new this.airQualityModel({
            ...data,
            source: 'AQICN',
          });
          await airQuality.save();

          // Cache the latest data
          await this.cacheService.set(`air_quality:${city}`, data, 3600);

          successCount++;
          this.logger.debug(`✅ Collected air quality for ${city}`);
        } else {
          errorCount++;
        }

        // Small delay to avoid rate limiting
        await this.sleep(500);
      } catch (error) {
        this.logger.error(`❌ Error collecting air quality for ${city}:`, error.message);
        errorCount++;
      }
    }

    this.logger.log(
      `✅ Air quality collection complete: ${successCount} success, ${errorCount} errors`,
    );
  }

  // Run every hour (at minute 5)
  @Cron('5 * * * *')
  async collectTemperatureData() {
    this.logger.log('🔄 Starting temperature data collection...');

    const locations = this.openWeatherService.getLocationsForCollection();
    let successCount = 0;
    let errorCount = 0;

    for (const location of locations) {
      try {
        const data = await this.openWeatherService.getTemperature(location.lat, location.lon);

        if (data) {
          // Save to MongoDB
          const temperature = new this.temperatureModel({
            ...data,
            source: 'OpenWeatherMap',
          });
          await temperature.save();

          // Cache the latest data
          await this.cacheService.set(`temperature:${location.name}`, data, 3600);

          successCount++;
          this.logger.debug(`✅ Collected temperature for ${location.name}`);
        } else {
          errorCount++;
        }

        // Small delay to avoid rate limiting
        await this.sleep(500);
      } catch (error) {
        this.logger.error(
          `❌ Error collecting temperature for ${location.name}:`,
          error.message,
        );
        errorCount++;
      }
    }

    this.logger.log(
      `✅ Temperature collection complete: ${successCount} success, ${errorCount} errors`,
    );
  }

  // Manual trigger for testing
  async collectAllData() {
    this.logger.log('🚀 Manual data collection triggered');
    await this.collectAirQualityData();
    await this.collectTemperatureData();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
