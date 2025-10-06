import { Test, TestingModule } from '@nestjs/testing';
import { AirQualityController } from './air-quality.controller';
import { AirQualityService } from '../services/air-quality.service';
import { NotFoundException } from '@nestjs/common';

describe('AirQualityController', () => {
  let controller: AirQualityController;
  let service: AirQualityService;

  const mockAirQualityData = {
    _id: '507f1f77bcf86cd799439011',
    city: 'Hanoi',
    country: 'Vietnam',
    aqi: 85,
    level: 'Moderate',
    coordinates: {
      type: 'Point',
      coordinates: [105.8542, 21.0285],
    },
    timestamp: new Date('2025-10-06T12:00:00Z'),
    pollutants: {
      pm25: 45.5,
      pm10: 67.2,
      o3: 32.1,
      no2: 18.5,
      so2: 5.2,
      co: 0.8,
    },
  };

  const mockCityList = [
    { name: 'Hanoi', country: 'Vietnam', coordinates: { type: 'Point', coordinates: [105.8542, 21.0285] } },
    { name: 'Bangkok', country: 'Thailand', coordinates: { type: 'Point', coordinates: [100.5018, 13.7563] } },
    { name: 'Singapore', country: 'Singapore', coordinates: { type: 'Point', coordinates: [103.8198, 1.3521] } },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AirQualityController],
      providers: [
        {
          provide: AirQualityService,
          useValue: {
            getCityList: jest.fn(),
            getAllLatest: jest.fn(),
            getLatestByCity: jest.fn(),
            getHistoricalData: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AirQualityController>(AirQualityController);
    service = module.get<AirQualityService>(AirQualityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCities', () => {
    it('should return list of cities', async () => {
      jest.spyOn(service, 'getCityList').mockResolvedValue(mockCityList);

      const result = await controller.getCities();

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('cities');
      expect(result.count).toBe(3);
      expect(result.cities).toEqual(mockCityList);
      expect(service.getCityList).toHaveBeenCalled();
    });

    it('should return empty list when no cities', async () => {
      jest.spyOn(service, 'getCityList').mockResolvedValue([]);

      const result = await controller.getCities();

      expect(result.count).toBe(0);
      expect(result.cities).toEqual([]);
    });
  });

  describe('getMapData', () => {
    it('should return air quality data for all cities', async () => {
      const mockAllData = [
        mockAirQualityData,
        { ...mockAirQualityData, city: 'Bangkok', country: 'Thailand', aqi: 72 },
      ];

      jest.spyOn(service, 'getAllLatest').mockResolvedValue(mockAllData as any);

      const result = await controller.getMapData();

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('data');
      expect(result.count).toBe(2);
      expect(result.data[0]).toHaveProperty('city');
      expect(result.data[0]).toHaveProperty('country');
      expect(result.data[0]).toHaveProperty('aqi');
      expect(result.data[0]).toHaveProperty('level');
      expect(result.data[0]).toHaveProperty('coordinates');
      expect(result.data[0]).toHaveProperty('timestamp');
    });

    it('should filter and return only required fields', async () => {
      jest.spyOn(service, 'getAllLatest').mockResolvedValue([mockAirQualityData as any]);

      const result = await controller.getMapData();

      const firstItem = result.data[0];
      expect(firstItem).not.toHaveProperty('pollutants');
      expect(firstItem).not.toHaveProperty('_id');
      expect(Object.keys(firstItem)).toEqual(['city', 'country', 'aqi', 'level', 'coordinates', 'timestamp']);
    });

    it('should return empty data when no cities have data', async () => {
      jest.spyOn(service, 'getAllLatest').mockResolvedValue([]);

      const result = await controller.getMapData();

      expect(result.count).toBe(0);
      expect(result.data).toEqual([]);
    });
  });

  describe('getByCity', () => {
    it('should return air quality data for specific city', async () => {
      jest.spyOn(service, 'getLatestByCity').mockResolvedValue(mockAirQualityData as any);

      const result = await controller.getByCity('hanoi');

      expect(result).toEqual(mockAirQualityData);
      expect(service.getLatestByCity).toHaveBeenCalledWith('hanoi');
    });

    it('should handle case-insensitive city names', async () => {
      jest.spyOn(service, 'getLatestByCity').mockResolvedValue(mockAirQualityData as any);

      await controller.getByCity('HANOI');

      expect(service.getLatestByCity).toHaveBeenCalledWith('HANOI');
    });

    it('should throw NotFoundException when city not found', async () => {
      jest.spyOn(service, 'getLatestByCity').mockRejectedValue(
        new NotFoundException('Air quality data not found for city: unknown-city')
      );

      await expect(controller.getByCity('unknown-city')).rejects.toThrow(NotFoundException);
      expect(service.getLatestByCity).toHaveBeenCalledWith('unknown-city');
    });

    it('should return data with all pollutants', async () => {
      jest.spyOn(service, 'getLatestByCity').mockResolvedValue(mockAirQualityData as any);

      const result = await controller.getByCity('hanoi');

      expect(result).toHaveProperty('pollutants');
      expect(result.pollutants).toHaveProperty('pm25');
      expect(result.pollutants).toHaveProperty('pm10');
      expect(result.pollutants).toHaveProperty('o3');
    });
  });

  describe('getHistory', () => {
    const mockHistoricalData = [
      { ...mockAirQualityData, timestamp: new Date('2025-10-06T12:00:00Z') },
      { ...mockAirQualityData, timestamp: new Date('2025-10-05T12:00:00Z'), aqi: 78 },
      { ...mockAirQualityData, timestamp: new Date('2025-10-04T12:00:00Z'), aqi: 92 },
    ];

    it('should return historical data for a city', async () => {
      jest.spyOn(service, 'getHistoricalData').mockResolvedValue(mockHistoricalData as any);

      const result = await controller.getHistory('hanoi');

      expect(result).toHaveProperty('city');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('data');
      expect(result.city).toBe('hanoi');
      expect(result.count).toBe(3);
      expect(result.data).toEqual(mockHistoricalData);
    });

    it('should return historical data with date range', async () => {
      const from = '2025-10-01T00:00:00Z';
      const to = '2025-10-06T23:59:59Z';

      jest.spyOn(service, 'getHistoricalData').mockResolvedValue(mockHistoricalData as any);

      const result = await controller.getHistory('hanoi', from, to);

      expect(service.getHistoricalData).toHaveBeenCalledWith(
        'hanoi',
        new Date(from),
        new Date(to)
      );
      expect(result.count).toBe(3);
    });

    it('should handle only from date', async () => {
      const from = '2025-10-01T00:00:00Z';

      jest.spyOn(service, 'getHistoricalData').mockResolvedValue(mockHistoricalData as any);

      await controller.getHistory('hanoi', from, undefined);

      expect(service.getHistoricalData).toHaveBeenCalledWith(
        'hanoi',
        new Date(from),
        undefined
      );
    });

    it('should handle only to date', async () => {
      const to = '2025-10-06T23:59:59Z';

      jest.spyOn(service, 'getHistoricalData').mockResolvedValue(mockHistoricalData as any);

      await controller.getHistory('hanoi', undefined, to);

      expect(service.getHistoricalData).toHaveBeenCalledWith(
        'hanoi',
        undefined,
        new Date(to)
      );
    });

    it('should return empty data when no historical records', async () => {
      jest.spyOn(service, 'getHistoricalData').mockResolvedValue([]);

      const result = await controller.getHistory('hanoi');

      expect(result.count).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('should parse date strings correctly', async () => {
      const from = '2025-10-01T00:00:00Z';
      const to = '2025-10-06T23:59:59Z';

      jest.spyOn(service, 'getHistoricalData').mockResolvedValue(mockHistoricalData as any);

      await controller.getHistory('hanoi', from, to);

      const callArgs = (service.getHistoricalData as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBeInstanceOf(Date);
      expect(callArgs[2]).toBeInstanceOf(Date);
    });
  });
});
