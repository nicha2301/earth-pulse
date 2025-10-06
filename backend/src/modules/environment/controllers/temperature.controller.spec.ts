import { Test, TestingModule } from '@nestjs/testing';
import { TemperatureController } from './temperature.controller';
import { TemperatureService } from '../services/temperature.service';
import { NotFoundException } from '@nestjs/common';

describe('TemperatureController', () => {
  let controller: TemperatureController;
  let service: TemperatureService;

  const mockTemperatureData = {
    _id: '507f1f77bcf86cd799439011',
    location: 'New York',
    country: 'United States',
    temperature: 18.5,
    feelsLike: 16.2,
    tempMin: 15.0,
    tempMax: 21.0,
    humidity: 65,
    pressure: 1013,
    weatherDescription: 'clear sky',
    coordinates: {
      type: 'Point',
      coordinates: [-74.006, 40.7128],
    },
    timestamp: new Date('2025-10-06T12:00:00Z'),
  };

  const mockLocationList = [
    { name: 'New York', country: 'United States', coordinates: { type: 'Point', coordinates: [-74.006, 40.7128] } },
    { name: 'London', country: 'United Kingdom', coordinates: { type: 'Point', coordinates: [-0.1276, 51.5074] } },
    { name: 'Tokyo', country: 'Japan', coordinates: { type: 'Point', coordinates: [139.6917, 35.6895] } },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemperatureController],
      providers: [
        {
          provide: TemperatureService,
          useValue: {
            getLocationList: jest.fn(),
            getAllLatest: jest.fn(),
            getGlobalAverage: jest.fn(),
            getLatestByLocation: jest.fn(),
            getHistoricalData: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TemperatureController>(TemperatureController);
    service = module.get<TemperatureService>(TemperatureService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLocations', () => {
    it('should return list of locations', async () => {
      jest.spyOn(service, 'getLocationList').mockResolvedValue(mockLocationList);

      const result = await controller.getLocations();

      expect(result.count).toBe(3);
      expect(result.locations).toEqual(mockLocationList);
    });
  });

  describe('getMapData', () => {
    it('should return temperature data for all locations', async () => {
      jest.spyOn(service, 'getAllLatest').mockResolvedValue([mockTemperatureData] as any);

      const result = await controller.getMapData();

      expect(result.count).toBe(1);
      expect(result.data[0]).toHaveProperty('location');
      expect(result.data[0]).toHaveProperty('temperature');
      expect(result.data[0]).toHaveProperty('feelsLike');
      expect(result.data[0]).toHaveProperty('weatherDescription');
    });
  });

  describe('getGlobalAverage', () => {
    it('should return global average temperature', async () => {
      jest.spyOn(service, 'getGlobalAverage').mockResolvedValue(20.5);

      const result = await controller.getGlobalAverage();

      expect(result.globalAverage).toBe(20.5);
      expect(result.unit).toBe('Celsius');
      expect(result).toHaveProperty('timestamp');
    });

    it('should include current timestamp', async () => {
      jest.spyOn(service, 'getGlobalAverage').mockResolvedValue(20.5);

      const beforeTime = new Date();
      const result = await controller.getGlobalAverage();
      const afterTime = new Date();

      const resultTime = new Date(result.timestamp);
      expect(resultTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(resultTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('getByLocation', () => {
    it('should return temperature data for specific location', async () => {
      jest.spyOn(service, 'getLatestByLocation').mockResolvedValue(mockTemperatureData as any);

      const result = await controller.getByLocation('New York');

      expect(result).toEqual(mockTemperatureData);
      expect(service.getLatestByLocation).toHaveBeenCalledWith('New York');
    });

    it('should throw NotFoundException when location not found', async () => {
      jest.spyOn(service, 'getLatestByLocation').mockRejectedValue(
        new NotFoundException('Temperature data not found for location: Unknown')
      );

      await expect(controller.getByLocation('Unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistory', () => {
    const mockHistoricalData = [
      { ...mockTemperatureData, timestamp: new Date('2025-10-06T12:00:00Z'), temperature: 18.5 },
      { ...mockTemperatureData, timestamp: new Date('2025-10-05T12:00:00Z'), temperature: 17.2 },
    ];

    it('should return historical data for a location', async () => {
      jest.spyOn(service, 'getHistoricalData').mockResolvedValue(mockHistoricalData as any);

      const result = await controller.getHistory('New York');

      expect(result.location).toBe('New York');
      expect(result.count).toBe(2);
      expect(result.data).toEqual(mockHistoricalData);
    });

    it('should handle date range parameters', async () => {
      const from = '2025-10-01T00:00:00Z';
      const to = '2025-10-06T23:59:59Z';

      jest.spyOn(service, 'getHistoricalData').mockResolvedValue(mockHistoricalData as any);

      await controller.getHistory('New York', from, to);

      expect(service.getHistoricalData).toHaveBeenCalledWith(
        'New York',
        new Date(from),
        new Date(to)
      );
    });
  });
});
