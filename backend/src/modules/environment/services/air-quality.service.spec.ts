import { Test, TestingModule } from '@nestjs/testing';
import { AirQualityService } from './air-quality.service';
import { CacheService } from './cache.service';
import { getModelToken } from '@nestjs/mongoose';
import { AirQuality } from '../schemas/air-quality.schema';
import { NotFoundException } from '@nestjs/common';

describe('AirQualityService', () => {
  let service: AirQualityService;
  let cacheService: CacheService;

  const mockAirQualityModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    distinct: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockAirQualityData = {
    _id: '507f1f77bcf86cd799439011',
    city: 'Hanoi',
    cityLower: 'hanoi',
    country: 'Vietnam',
    aqi: 85,
    level: 'Moderate',
    coordinates: { type: 'Point', coordinates: [105.8542, 21.0285] },
    timestamp: new Date(),
    toObject: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirQualityService,
        {
          provide: getModelToken(AirQuality.name),
          useValue: mockAirQualityModel,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<AirQualityService>(AirQualityService);
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLatestByCity', () => {
    it('should return cached data if available', async () => {
      mockCacheService.get.mockResolvedValue(mockAirQualityData);

      const result = await service.getLatestByCity('Hanoi');

      expect(result).toEqual(mockAirQualityData);
      expect(cacheService.get).toHaveBeenCalledWith('air_quality:Hanoi');
      expect(mockAirQualityModel.findOne).not.toHaveBeenCalled();
    });

    it('should query database if not cached', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAirQualityModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockAirQualityData),
        }),
      });

      const result = await service.getLatestByCity('Hanoi');

      expect(mockAirQualityModel.findOne).toHaveBeenCalledWith({ cityLower: 'hanoi' });
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException if no data found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAirQualityModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getLatestByCity('Unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllLatest', () => {
    it('should return latest data for all cities', async () => {
      mockAirQualityModel.distinct.mockResolvedValue(['Hanoi', 'Bangkok']);
      mockCacheService.get.mockResolvedValue(mockAirQualityData);

      const result = await service.getAllLatest();

      expect(result).toHaveLength(2);
      expect(mockAirQualityModel.distinct).toHaveBeenCalledWith('city');
    });
  });

  describe('getCityList', () => {
    it('should return list of unique cities', async () => {
      const mockData = [
        { city: 'Hanoi', country: 'Vietnam', coordinates: {} },
        { city: 'Hanoi', country: 'Vietnam', coordinates: {} },
        { city: 'Bangkok', country: 'Thailand', coordinates: {} },
      ];

      mockAirQualityModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockData),
        }),
      });

      const result = await service.getCityList();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Hanoi');
      expect(result[1].name).toBe('Bangkok');
    });
  });

  describe('getHistoricalData', () => {
    it('should return historical data with date range', async () => {
      const from = new Date('2025-10-01');
      const to = new Date('2025-10-06');

      mockAirQualityModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockAirQualityData]),
          }),
        }),
      });

      const result = await service.getHistoricalData('Hanoi', from, to);

      expect(result).toHaveLength(1);
      expect(mockAirQualityModel.find).toHaveBeenCalled();
    });
  });
});
