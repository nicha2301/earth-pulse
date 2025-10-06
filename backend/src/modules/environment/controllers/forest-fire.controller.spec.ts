import { Test, TestingModule } from '@nestjs/testing';
import { ForestFireController } from './forest-fire.controller';
import { ForestFireService } from '../services/forest-fire.service';

describe('ForestFireController', () => {
  let controller: ForestFireController;
  let service: ForestFireService;

  const mockFireData = {
    latitude: 21.5,
    longitude: 105.8,
    brightness: 330.5,
    confidence: 'nominal',
    acq_date: '2025-10-06',
    satellite: 'N',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForestFireController],
      providers: [
        {
          provide: ForestFireService,
          useValue: {
            getActiveFires: jest.fn(),
            getFiresForMap: jest.fn(),
            getFireHistory: jest.fn(),
            getFireStatistics: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ForestFireController>(ForestFireController);
    service = module.get<ForestFireService>(ForestFireService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveFires', () => {
    it('should return active fires', async () => {
      jest.spyOn(service, 'getActiveFires').mockResolvedValue([mockFireData] as any);

      const result = await controller.getActiveFires();

      expect(result.count).toBe(1);
      expect(result.fires).toEqual([mockFireData]);
      expect(result).toHaveProperty('timestamp');
    });

    it('should return empty array when no active fires', async () => {
      jest.spyOn(service, 'getActiveFires').mockResolvedValue([]);

      const result = await controller.getActiveFires();

      expect(result.count).toBe(0);
      expect(result.fires).toEqual([]);
    });
  });

  describe('getFiresForMap', () => {
    it('should return fires optimized for map display', async () => {
      jest.spyOn(service, 'getFiresForMap').mockResolvedValue([mockFireData] as any);

      const result = await controller.getFiresForMap();

      expect(result.count).toBe(1);
      expect(result.data).toEqual([mockFireData]);
    });
  });

  describe('getFireHistory', () => {
    it('should return fire history with date range', async () => {
      const mockResult = {
        count: 1,
        data: [mockFireData],
      };

      jest.spyOn(service, 'getFireHistory').mockResolvedValue(mockResult as any);

      const result = await controller.getFireHistory({ from: '2025-10-01', to: '2025-10-06' });

      expect(result).toEqual(mockResult);
    });
  });

});
