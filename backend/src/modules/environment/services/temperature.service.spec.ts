import { Test, TestingModule } from '@nestjs/testing';
import { TemperatureService } from './temperature.service';
import { CacheService } from './cache.service';
import { getModelToken } from '@nestjs/mongoose';
import { Temperature } from '../schemas/temperature.schema';
import { NotFoundException } from '@nestjs/common';

describe('TemperatureService', () => {
  let service: TemperatureService;

  const mockTemperatureModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    distinct: jest.fn(),
    aggregate: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockTemperatureData = {
    location: 'New York',
    locationLower: 'new york',
    country: 'United States',
    temperature: 18.5,
    timestamp: new Date(),
    toObject: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemperatureService,
        {
          provide: getModelToken(Temperature.name),
          useValue: mockTemperatureModel,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<TemperatureService>(TemperatureService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLatestByLocation', () => {
    it('should return cached data if available', async () => {
      mockCacheService.get.mockResolvedValue(mockTemperatureData);

      const result = await service.getLatestByLocation('New York');

      expect(result).toEqual(mockTemperatureData);
      expect(mockCacheService.get).toHaveBeenCalled();
    });

    it('should query database if not cached', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTemperatureModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockTemperatureData),
        }),
      });

      const result = await service.getLatestByLocation('New York');

      expect(mockTemperatureModel.findOne).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException if no data found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTemperatureModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getLatestByLocation('Unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllLatest', () => {
    it('should return latest data for all locations', async () => {
      mockTemperatureModel.distinct.mockResolvedValue(['New York', 'London']);
      mockCacheService.get.mockResolvedValue(mockTemperatureData);

      const result = await service.getAllLatest();

      expect(result).toHaveLength(2);
    });
  });

  describe('getGlobalAverage', () => {
    it('should return global average temperature', async () => {
      mockTemperatureModel.aggregate.mockResolvedValue([{ avgTemp: 20.5 }]);

      const result = await service.getGlobalAverage();

      expect(result).toBe(20.5);
      expect(mockTemperatureModel.aggregate).toHaveBeenCalled();
    });

    it('should return 0 if no data available', async () => {
      mockTemperatureModel.aggregate.mockResolvedValue([]);

      const result = await service.getGlobalAverage();

      expect(result).toBe(0);
    });
  });
});
