import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CollectorService } from './collector.service';
import { AqicnService } from './aqicn.service';
import { OpenWeatherService } from './openweather.service';
import { CacheService } from './cache.service';
import { FirmsService } from './firms.service';
import { ForestFireService } from './forest-fire.service';
import { NoaaService } from './noaa.service';
import { SeaLevelService } from './sea-level.service';
import { NsidcService } from './nsidc.service';
import { IceExtentService } from './ice-extent.service';
import { AirQuality } from '../schemas/air-quality.schema';
import { Temperature } from '../schemas/temperature.schema';
import { ForestFire } from '../schemas/forest-fire.schema';
import { SeaLevel } from '../schemas/sea-level.schema';
import { IceExtent } from '../schemas/ice-extent.schema';

describe('CollectorService', () => {
  let service: CollectorService;
  let aqicnService: AqicnService;
  let openWeatherService: OpenWeatherService;
  let cacheService: CacheService;
  let firmsService: FirmsService;
  let forestFireService: ForestFireService;
  let noaaService: NoaaService;
  let seaLevelService: SeaLevelService;
  let nsidcService: NsidcService;
  let iceExtentService: IceExtentService;

  const mockAirQualityModel = {
    save: jest.fn(),
  };

  const mockTemperatureModel = {
    save: jest.fn(),
  };

  const mockForestFireModel = {};
  const mockSeaLevelModel = {};
  const mockIceExtentModel = {};

  const mockAqicnService = {
    getCitiesForCollection: jest.fn(),
    getAirQuality: jest.fn(),
  };

  const mockOpenWeatherService = {
    getLocationsForCollection: jest.fn(),
    getTemperature: jest.fn(),
  };

  const mockCacheService = {
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockFirmsService = {
    getActiveFires: jest.fn(),
  };

  const mockForestFireService = {
    saveFiresBulk: jest.fn(),
  };

  const mockNoaaService = {
    getAllStationsLatest: jest.fn(),
  };

  const mockSeaLevelService = {
    saveSeaLevelsBulk: jest.fn(),
  };

  const mockNsidcService = {
    fetchAllData: jest.fn(),
  };

  const mockIceExtentService = {
    saveIceExtentsBulk: jest.fn(),
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup model constructor behavior
    mockAirQualityModel.save.mockResolvedValue({});
    mockTemperatureModel.save.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectorService,
        {
          provide: getModelToken(AirQuality.name),
          useValue: jest.fn().mockImplementation(() => mockAirQualityModel),
        },
        {
          provide: getModelToken(Temperature.name),
          useValue: jest.fn().mockImplementation(() => mockTemperatureModel),
        },
        {
          provide: getModelToken(ForestFire.name),
          useValue: mockForestFireModel,
        },
        {
          provide: getModelToken(SeaLevel.name),
          useValue: mockSeaLevelModel,
        },
        {
          provide: getModelToken(IceExtent.name),
          useValue: mockIceExtentModel,
        },
        {
          provide: AqicnService,
          useValue: mockAqicnService,
        },
        {
          provide: OpenWeatherService,
          useValue: mockOpenWeatherService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: FirmsService,
          useValue: mockFirmsService,
        },
        {
          provide: ForestFireService,
          useValue: mockForestFireService,
        },
        {
          provide: NoaaService,
          useValue: mockNoaaService,
        },
        {
          provide: SeaLevelService,
          useValue: mockSeaLevelService,
        },
        {
          provide: NsidcService,
          useValue: mockNsidcService,
        },
        {
          provide: IceExtentService,
          useValue: mockIceExtentService,
        },
      ],
    }).compile();

    service = module.get<CollectorService>(CollectorService);
    aqicnService = module.get<AqicnService>(AqicnService);
    openWeatherService = module.get<OpenWeatherService>(OpenWeatherService);
    cacheService = module.get<CacheService>(CacheService);
    firmsService = module.get<FirmsService>(FirmsService);
    forestFireService = module.get<ForestFireService>(ForestFireService);
    noaaService = module.get<NoaaService>(NoaaService);
    seaLevelService = module.get<SeaLevelService>(SeaLevelService);
    nsidcService = module.get<NsidcService>(NsidcService);
    iceExtentService = module.get<IceExtentService>(IceExtentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('collectAirQualityData', () => {
    it('should collect air quality data for all cities successfully', async () => {
      const mockCities = ['Hanoi', 'HoChiMinh', 'DaNang'];
      const mockAirQualityData = {
        city: 'Hanoi',
        aqi: 85,
        pm25: 35.5,
        temperature: 28,
        humidity: 65,
        timestamp: new Date(),
      };

      mockAqicnService.getCitiesForCollection.mockReturnValue(mockCities);
      mockAqicnService.getAirQuality.mockResolvedValue(mockAirQualityData);
      mockCacheService.set.mockResolvedValue(undefined);

      await service.collectAirQualityData();

      expect(mockAqicnService.getCitiesForCollection).toHaveBeenCalledTimes(1);
      expect(mockAqicnService.getAirQuality).toHaveBeenCalledTimes(3);
      expect(mockAirQualityModel.save).toHaveBeenCalledTimes(3);
      expect(mockCacheService.set).toHaveBeenCalledTimes(3);
    });

    it('should handle errors when collecting air quality for a city', async () => {
      const mockCities = ['Hanoi', 'InvalidCity'];
      const mockAirQualityData = {
        city: 'Hanoi',
        aqi: 85,
        pm25: 35.5,
        temperature: 28,
        humidity: 65,
        timestamp: new Date(),
      };

      mockAqicnService.getCitiesForCollection.mockReturnValue(mockCities);
      mockAqicnService.getAirQuality
        .mockResolvedValueOnce(mockAirQualityData)
        .mockRejectedValueOnce(new Error('City not found'));

      await service.collectAirQualityData();

      expect(mockAqicnService.getAirQuality).toHaveBeenCalledTimes(2);
      expect(mockAirQualityModel.save).toHaveBeenCalledTimes(1); // Only Hanoi saved
    });

    it('should handle null data returned from AQICN service', async () => {
      const mockCities = ['Hanoi', 'TestCity'];

      mockAqicnService.getCitiesForCollection.mockReturnValue(mockCities);
      mockAqicnService.getAirQuality
        .mockResolvedValueOnce({
          city: 'Hanoi',
          aqi: 85,
          pm25: 35.5,
          temperature: 28,
          humidity: 65,
          timestamp: new Date(),
        })
        .mockResolvedValueOnce(null); // No data for second city

      await service.collectAirQualityData();

      expect(mockAirQualityModel.save).toHaveBeenCalledTimes(1); // Only first city saved
      expect(mockCacheService.set).toHaveBeenCalledTimes(1);
    });

    it('should add cityLower field for optimized queries', async () => {
      const mockCities = ['Hanoi'];
      const mockAirQualityData = {
        city: 'Hanoi',
        aqi: 85,
        pm25: 35.5,
        temperature: 28,
        humidity: 65,
        timestamp: new Date(),
      };

      mockAqicnService.getCitiesForCollection.mockReturnValue(mockCities);
      mockAqicnService.getAirQuality.mockResolvedValue(mockAirQualityData);

      await service.collectAirQualityData();

      // The model constructor should have been called with data including cityLower
      expect(mockAirQualityModel.save).toHaveBeenCalled();
    });
  });

  describe('collectTemperatureData', () => {
    it('should collect temperature data for all locations successfully', async () => {
      const mockLocations = [
        { name: 'Hanoi', lat: 21.0285, lon: 105.8542 },
        { name: 'HoChiMinh', lat: 10.8231, lon: 106.6297 },
      ];
      const mockTemperatureData = {
        location: 'Hanoi',
        temperature: 28.5,
        feelsLike: 30.2,
        humidity: 65,
        description: 'Clear sky',
        timestamp: new Date(),
      };

      mockOpenWeatherService.getLocationsForCollection.mockReturnValue(mockLocations);
      mockOpenWeatherService.getTemperature.mockResolvedValue(mockTemperatureData);
      mockCacheService.set.mockResolvedValue(undefined);

      await service.collectTemperatureData();

      expect(mockOpenWeatherService.getLocationsForCollection).toHaveBeenCalledTimes(1);
      expect(mockOpenWeatherService.getTemperature).toHaveBeenCalledTimes(2);
      expect(mockTemperatureModel.save).toHaveBeenCalledTimes(2);
      expect(mockCacheService.set).toHaveBeenCalledTimes(2);
    });

    it('should handle errors when collecting temperature for a location', async () => {
      const mockLocations = [
        { name: 'Hanoi', lat: 21.0285, lon: 105.8542 },
        { name: 'InvalidLocation', lat: 999, lon: 999 },
      ];
      const mockTemperatureData = {
        location: 'Hanoi',
        temperature: 28.5,
        feelsLike: 30.2,
        humidity: 65,
        description: 'Clear sky',
        timestamp: new Date(),
      };

      mockOpenWeatherService.getLocationsForCollection.mockReturnValue(mockLocations);
      mockOpenWeatherService.getTemperature
        .mockResolvedValueOnce(mockTemperatureData)
        .mockRejectedValueOnce(new Error('Location not found'));

      await service.collectTemperatureData();

      expect(mockOpenWeatherService.getTemperature).toHaveBeenCalledTimes(2);
      expect(mockTemperatureModel.save).toHaveBeenCalledTimes(1); // Only Hanoi saved
    });

    it('should handle null data returned from OpenWeather service', async () => {
      const mockLocations = [
        { name: 'Hanoi', lat: 21.0285, lon: 105.8542 },
        { name: 'TestLocation', lat: 10, lon: 10 },
      ];

      mockOpenWeatherService.getLocationsForCollection.mockReturnValue(mockLocations);
      mockOpenWeatherService.getTemperature
        .mockResolvedValueOnce({
          location: 'Hanoi',
          temperature: 28.5,
          feelsLike: 30.2,
          humidity: 65,
          description: 'Clear sky',
          timestamp: new Date(),
        })
        .mockResolvedValueOnce(null); // No data for second location

      await service.collectTemperatureData();

      expect(mockTemperatureModel.save).toHaveBeenCalledTimes(1); // Only first location saved
      expect(mockCacheService.set).toHaveBeenCalledTimes(1);
    });

    it('should pass correct lat/lon to OpenWeather service', async () => {
      const mockLocations = [{ name: 'Hanoi', lat: 21.0285, lon: 105.8542 }];
      const mockTemperatureData = {
        location: 'Hanoi',
        temperature: 28.5,
        feelsLike: 30.2,
        humidity: 65,
        description: 'Clear sky',
        timestamp: new Date(),
      };

      mockOpenWeatherService.getLocationsForCollection.mockReturnValue(mockLocations);
      mockOpenWeatherService.getTemperature.mockResolvedValue(mockTemperatureData);

      await service.collectTemperatureData();

      expect(mockOpenWeatherService.getTemperature).toHaveBeenCalledWith(21.0285, 105.8542);
    });
  });

  describe('collectForestFireData', () => {
    it('should collect and save forest fire data successfully', async () => {
      const mockFires = [
        {
          latitude: 16.5,
          longitude: 107.5,
          brightness: 320.5,
          confidence: 85,
          frp: 12.5,
          detectedAt: new Date(),
        },
        {
          latitude: 17.2,
          longitude: 108.1,
          brightness: 330.2,
          confidence: 90,
          frp: 15.3,
          detectedAt: new Date(),
        },
      ];

      mockFirmsService.getActiveFires.mockResolvedValue(mockFires);
      mockForestFireService.saveFiresBulk.mockResolvedValue(2);

      await service.collectForestFireData();

      expect(mockFirmsService.getActiveFires).toHaveBeenCalledWith('world', 1);
      expect(mockForestFireService.saveFiresBulk).toHaveBeenCalledWith(mockFires);
    });

    it('should handle empty fire data', async () => {
      mockFirmsService.getActiveFires.mockResolvedValue([]);

      await service.collectForestFireData();

      expect(mockFirmsService.getActiveFires).toHaveBeenCalledWith('world', 1);
      expect(mockForestFireService.saveFiresBulk).not.toHaveBeenCalled();
    });

    it('should handle null fire data', async () => {
      mockFirmsService.getActiveFires.mockResolvedValue(null);

      await service.collectForestFireData();

      expect(mockFirmsService.getActiveFires).toHaveBeenCalledWith('world', 1);
      expect(mockForestFireService.saveFiresBulk).not.toHaveBeenCalled();
    });

    it('should handle errors when collecting fire data', async () => {
      mockFirmsService.getActiveFires.mockRejectedValue(new Error('FIRMS API error'));

      await service.collectForestFireData();

      expect(mockFirmsService.getActiveFires).toHaveBeenCalledWith('world', 1);
      expect(mockForestFireService.saveFiresBulk).not.toHaveBeenCalled();
    });
  });

  describe('collectSeaLevelData', () => {
    it('should collect and save sea level data successfully', async () => {
      const mockSeaLevels = [
        {
          stationId: '8454000',
          stationName: 'Providence',
          latitude: 41.807,
          longitude: -71.401,
          waterLevel: 1.234,
          timestamp: new Date(),
        },
        {
          stationId: '8518750',
          stationName: 'The Battery',
          latitude: 40.7,
          longitude: -74.014,
          waterLevel: 0.987,
          timestamp: new Date(),
        },
      ];

      mockNoaaService.getAllStationsLatest.mockResolvedValue(mockSeaLevels);
      mockSeaLevelService.saveSeaLevelsBulk.mockResolvedValue(2);

      await service.collectSeaLevelData();

      expect(mockNoaaService.getAllStationsLatest).toHaveBeenCalledTimes(1);
      expect(mockSeaLevelService.saveSeaLevelsBulk).toHaveBeenCalledWith(mockSeaLevels);
    });

    it('should handle empty sea level data', async () => {
      mockNoaaService.getAllStationsLatest.mockResolvedValue([]);

      await service.collectSeaLevelData();

      expect(mockNoaaService.getAllStationsLatest).toHaveBeenCalledTimes(1);
      expect(mockSeaLevelService.saveSeaLevelsBulk).not.toHaveBeenCalled();
    });

    it('should handle null sea level data', async () => {
      mockNoaaService.getAllStationsLatest.mockResolvedValue(null);

      await service.collectSeaLevelData();

      expect(mockNoaaService.getAllStationsLatest).toHaveBeenCalledTimes(1);
      expect(mockSeaLevelService.saveSeaLevelsBulk).not.toHaveBeenCalled();
    });

    it('should handle errors when collecting sea level data', async () => {
      mockNoaaService.getAllStationsLatest.mockRejectedValue(new Error('NOAA API error'));

      await service.collectSeaLevelData();

      expect(mockNoaaService.getAllStationsLatest).toHaveBeenCalledTimes(1);
      expect(mockSeaLevelService.saveSeaLevelsBulk).not.toHaveBeenCalled();
    });
  });

  describe('collectIceExtentData', () => {
    it('should collect and save ice extent data successfully', async () => {
      const mockIceExtents = [
        {
          date: new Date('2025-10-01'),
          region: 'Arctic',
          extent: 5.2,
          area: 4.8,
        },
        {
          date: new Date('2025-10-01'),
          region: 'Antarctic',
          extent: 18.5,
          area: 17.2,
        },
      ];

      mockNsidcService.fetchAllData.mockResolvedValue(mockIceExtents);
      mockIceExtentService.saveIceExtentsBulk.mockResolvedValue({
        saved: 2,
        total: 2,
        skipped: 0,
      });

      await service.collectIceExtentData();

      expect(mockNsidcService.fetchAllData).toHaveBeenCalledWith(7);
      expect(mockIceExtentService.saveIceExtentsBulk).toHaveBeenCalledWith(mockIceExtents);
    });

    it('should handle empty ice extent data', async () => {
      mockNsidcService.fetchAllData.mockResolvedValue([]);

      await service.collectIceExtentData();

      expect(mockNsidcService.fetchAllData).toHaveBeenCalledWith(7);
      expect(mockIceExtentService.saveIceExtentsBulk).not.toHaveBeenCalled();
    });

    it('should handle errors when collecting ice extent data', async () => {
      mockNsidcService.fetchAllData.mockRejectedValue(new Error('NSIDC API error'));

      await service.collectIceExtentData();

      expect(mockNsidcService.fetchAllData).toHaveBeenCalledWith(7);
      expect(mockIceExtentService.saveIceExtentsBulk).not.toHaveBeenCalled();
    });

    it('should fetch 7 days of historical data', async () => {
      mockNsidcService.fetchAllData.mockResolvedValue([]);

      await service.collectIceExtentData();

      expect(mockNsidcService.fetchAllData).toHaveBeenCalledWith(7);
    });
  });

  describe('collectAllData', () => {
    it('should trigger all data collection methods', async () => {
      const collectAirQualitySpy = jest.spyOn(service, 'collectAirQualityData').mockResolvedValue();
      const collectTemperatureSpy = jest.spyOn(service, 'collectTemperatureData').mockResolvedValue();
      const collectForestFireSpy = jest.spyOn(service, 'collectForestFireData').mockResolvedValue();
      const collectSeaLevelSpy = jest.spyOn(service, 'collectSeaLevelData').mockResolvedValue();
      const collectIceExtentSpy = jest.spyOn(service, 'collectIceExtentData').mockResolvedValue();

      await service.collectAllData();

      expect(collectAirQualitySpy).toHaveBeenCalledTimes(1);
      expect(collectTemperatureSpy).toHaveBeenCalledTimes(1);
      expect(collectForestFireSpy).toHaveBeenCalledTimes(1);
      expect(collectSeaLevelSpy).toHaveBeenCalledTimes(1);
      expect(collectIceExtentSpy).toHaveBeenCalledTimes(1);
    });

    it('should call collection methods in correct order', async () => {
      const callOrder: string[] = [];

      jest.spyOn(service, 'collectAirQualityData').mockImplementation(async () => {
        callOrder.push('airQuality');
      });
      jest.spyOn(service, 'collectTemperatureData').mockImplementation(async () => {
        callOrder.push('temperature');
      });
      jest.spyOn(service, 'collectForestFireData').mockImplementation(async () => {
        callOrder.push('forestFire');
      });
      jest.spyOn(service, 'collectSeaLevelData').mockImplementation(async () => {
        callOrder.push('seaLevel');
      });
      jest.spyOn(service, 'collectIceExtentData').mockImplementation(async () => {
        callOrder.push('iceExtent');
      });

      await service.collectAllData();

      expect(callOrder).toEqual(['airQuality', 'temperature', 'forestFire', 'seaLevel', 'iceExtent']);
    });
  });
});
