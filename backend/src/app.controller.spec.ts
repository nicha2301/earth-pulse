import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get<AppService>(AppService);
  });

  describe('getRoot', () => {
    it('should return API info', () => {
      const result = controller.getRoot();

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('docs');
      expect(result.message).toBe('Realtime Earth API');
      expect(result.version).toBe('1.0.0');
      expect(result.docs).toBe('/api/docs');
    });
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const mockHealth = {
        status: 'ok',
        timestamp: '2025-10-06T12:00:00.000Z',
        uptime: 12345,
        memory: {
          rss: 50000000,
          heapTotal: 20000000,
          heapUsed: 15000000,
          external: 1000000,
          arrayBuffers: 500000,
        },
      };

      jest.spyOn(service, 'getHealth').mockReturnValue(mockHealth);

      const result = controller.getHealth();

      expect(result).toEqual(mockHealth);
      expect(result.status).toBe('ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('memory');
    });

    it('should call service.getHealth', () => {
      const spy = jest.spyOn(service, 'getHealth');
      controller.getHealth();
      expect(spy).toHaveBeenCalled();
    });
  });
});
