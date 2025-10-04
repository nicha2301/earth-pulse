import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AirQualityController } from './controllers/air-quality.controller';
import { CacheService } from './services/cache.service';
import { AirQuality, AirQualitySchema } from './schemas/air-quality.schema';
import { TemperatureController } from './controllers/temperature.controller';
import { HttpModule } from '@nestjs/axios';
import { Temperature, TemperatureSchema } from './schemas/temperature.schema';
import { AirQualityService } from './services/air-quality.service';
import { TemperatureService } from './services/temperature.service';
import { AqicnService } from './services/aqicn.service';
import { OpenWeatherService } from './services/openweather.service';
import { CollectorService } from './services/collector.service';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: AirQuality.name, schema: AirQualitySchema },
      { name: Temperature.name, schema: TemperatureSchema },
    ]),
  ],
  controllers: [AirQualityController, TemperatureController],
  providers: [
    AirQualityService,
    TemperatureService,
    AqicnService,
    OpenWeatherService,
    CollectorService,
    CacheService,
  ],
})
export class EnvironmentModule {}
