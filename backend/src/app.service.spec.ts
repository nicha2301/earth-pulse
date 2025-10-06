import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const result = service.getHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('memory');
      expect(result.status).toBe('ok');
    });

    it('should return timestamp as ISO string', () => {
      const result = service.getHealth();
      
      expect(typeof result.timestamp).toBe('string');
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it('should return process uptime', () => {
      const result = service.getHealth();
      
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return memory usage', () => {
      const result = service.getHealth();
      
      expect(result.memory).toHaveProperty('rss');
      expect(result.memory).toHaveProperty('heapTotal');
      expect(result.memory).toHaveProperty('heapUsed');
      expect(result.memory).toHaveProperty('external');
    });

    it('should have valid memory values', () => {
      const result = service.getHealth();
      
      expect(result.memory.rss).toBeGreaterThan(0);
      expect(result.memory.heapTotal).toBeGreaterThan(0);
      expect(result.memory.heapUsed).toBeGreaterThan(0);
      expect(result.memory.heapUsed).toBeLessThanOrEqual(result.memory.heapTotal);
    });
  });
});
