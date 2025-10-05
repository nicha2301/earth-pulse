import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AqicnService } from './aqicn.service';
import { OpenWeatherService } from './openweather.service';
import { CacheService } from './cache.service';
import { AirQuality, AirQualityDocument } from '../schemas/air-quality.schema';
import { Temperature, TemperatureDocument } from '../schemas/temperature.schema';
import { ForestFire, ForestFireDocument } from '../schemas/forest-fire.schema';
import { FirmsService } from './firms.service';
import { ForestFireService } from './forest-fire.service';
import { SeaLevel, SeaLevelDocument } from '../schemas/sea-level.schema';
import { NoaaService } from './noaa.service';
import { SeaLevelService } from './sea-level.service';
import { IceExtent, IceExtentDocument } from '../schemas/ice-extent.schema';
import { NsidcService } from './nsidc.service';
import { IceExtentService } from './ice-extent.service';

@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);

  constructor(
    @InjectModel(AirQuality.name)
    private airQualityModel: Model<AirQualityDocument>,
    @InjectModel(Temperature.name)
    private temperatureModel: Model<TemperatureDocument>,
    @InjectModel(ForestFire.name)
    private forestFireModel: Model<ForestFireDocument>,
    @InjectModel(SeaLevel.name)
    private seaLevelModel: Model<SeaLevelDocument>,
    @InjectModel(IceExtent.name)
    private iceExtentModel: Model<IceExtentDocument>,
    private aqicnService: AqicnService,
    private openWeatherService: OpenWeatherService,
    private cacheService: CacheService,
    private firmsService: FirmsService,
    private forestFireService: ForestFireService,
    private noaaService: NoaaService,
    private seaLevelService: SeaLevelService,
    private nsidcService: NsidcService,
    private iceExtentService: IceExtentService,
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
          // Save to MongoDB with lowercase field for optimized queries
          const airQuality = new this.airQualityModel({
            ...data,
            cityLower: data.city.toLowerCase(), // For case-insensitive index
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
          // Save to MongoDB with lowercase field for optimized queries
          const temperature = new this.temperatureModel({
            ...data,
            locationLower: data.location.toLowerCase(), // For case-insensitive index
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

  // Run every 3 hours (at minute 0 of every 3rd hour)
  @Cron('0 */3 * * *')
  async collectForestFireData() {
    this.logger.log('🔥 Starting forest fire data collection...');

    try {
      // Get active fires from NASA FIRMS (last 24 hours)
      const fires = await this.firmsService.getActiveFires('world', 1);

      if (fires && fires.length > 0) {
        // Save fires to database
        const savedCount = await this.forestFireService.saveFiresBulk(fires);

        this.logger.log(
          `✅ Forest fire collection complete: ${savedCount} fires saved out of ${fires.length} detected`,
        );
      } else {
        this.logger.log('ℹ️ No active fires detected');
      }
    } catch (error) {
      this.logger.error('❌ Error collecting forest fire data:', error.message);
    }
  }

  // Run every hour (at minute 10)
  @Cron('10 * * * *')
  async collectSeaLevelData() {
    this.logger.log('🌊 Starting sea level data collection...');

    try {
      // Get all 25 stations latest data from NOAA
      const seaLevels = await this.noaaService.getAllStationsLatest();

      if (seaLevels && seaLevels.length > 0) {
        // Save to database
        const savedCount = await this.seaLevelService.saveSeaLevelsBulk(seaLevels);

        this.logger.log(
          `✅ Sea level collection complete: ${savedCount} readings saved out of ${seaLevels.length} fetched`,
        );
      } else {
        this.logger.log('ℹ️ No sea level data available');
      }
    } catch (error) {
      this.logger.error('❌ Error collecting sea level data:', error.message);
    }
  }

  // Manual trigger for testing
  async collectAllData() {
    this.logger.log('🚀 Manual data collection triggered');
    await this.collectAirQualityData();
    await this.collectTemperatureData();
    await this.collectForestFireData();
    await this.collectSeaLevelData();
    await this.collectIceExtentData();
  }

  // Run daily at 6:00 AM
  @Cron('0 6 * * *')
  async collectIceExtentData() {
    try {
      this.logger.log('❄️ Starting ice extent data collection...');

      // Fetch last 7 days of data for both Arctic and Antarctic
      // This ensures we don't miss any updates
      const iceExtents = await this.nsidcService.fetchAllData(7);

      if (iceExtents.length === 0) {
        this.logger.warn('No ice extent data fetched from NSIDC');
        return;
      }

      this.logger.log(`Fetched ${iceExtents.length} ice extent readings from NSIDC`);

      // Save to database (bulk insert, skip duplicates)
      const result = await this.iceExtentService.saveIceExtentsBulk(iceExtents);

      this.logger.log(
        `✅ Ice extent collection complete: ${result.saved} new readings saved out of ${result.total} fetched`,
      );
    } catch (error) {
      this.logger.error('Error collecting ice extent data:', error.message);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
