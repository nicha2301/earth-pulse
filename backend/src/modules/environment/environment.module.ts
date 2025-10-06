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
import { ForestFireController } from './controllers/forest-fire.controller';
import { ForestFire, ForestFireSchema } from './schemas/forest-fire.schema';
import { ForestFireService } from './services/forest-fire.service';
import { FirmsService } from './services/firms.service';
import { SeaLevelController } from './controllers/sea-level.controller';
import { SeaLevel, SeaLevelSchema } from './schemas/sea-level.schema';
import { SeaLevelService } from './services/sea-level.service';
import { NoaaService } from './services/noaa.service';
import { IceExtentController } from './controllers/ice-extent.controller';
import { IceExtent, IceExtentSchema } from './schemas/ice-extent.schema';
import { IceExtentService } from './services/ice-extent.service';
import { NsidcService } from './services/nsidc.service';
import { CollectorController } from './controllers/collector.controller';
import { HistoricalCollectorController } from './controllers/historical-collector.controller';
import { CircuitBreakerController } from './controllers/circuit-breaker.controller';
import { HistoricalCollectorService } from './services/historical-collector.service';
import { FirmsArchiveService } from './services/firms-archive.service';
import { ConfigValidationService } from './services/config-validation.service';
import { MetricsService } from './services/metrics.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { CleanupService } from './services/cleanup.service';
import { CleanupController } from './controllers/cleanup.controller';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: AirQuality.name, schema: AirQualitySchema },
      { name: Temperature.name, schema: TemperatureSchema },
      { name: ForestFire.name, schema: ForestFireSchema },
      { name: SeaLevel.name, schema: SeaLevelSchema },
      { name: IceExtent.name, schema: IceExtentSchema },
    ]),
  ],
  controllers: [
    AirQualityController,
    TemperatureController,
    ForestFireController,
    SeaLevelController,
    IceExtentController,
    CollectorController,
    HistoricalCollectorController,
    CircuitBreakerController,
    CleanupController,
  ],
  providers: [
    ConfigValidationService,
    MetricsService,
    CircuitBreakerService,
    AirQualityService,
    TemperatureService,
    AqicnService,
    OpenWeatherService,
    CollectorService,
    CacheService,
    ForestFireService,
    FirmsService,
    SeaLevelService,
    NoaaService,
    IceExtentService,
    NsidcService,
    HistoricalCollectorService,
    FirmsArchiveService,
    CleanupService,
  ],
})
export class EnvironmentModule {}
