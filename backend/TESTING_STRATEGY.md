# Automated Testing Strategy for Earth Pulse Backend

## 🎯 Testing Goals

1. **Code Coverage**: Achieve >70% coverage
2. **Reliability**: Catch bugs before production
3. **Confidence**: Enable safe refactoring
4. **Documentation**: Tests as living documentation

---

## 📋 Testing Pyramid

```
        /\
       /E2E\          (Few - Critical user flows)
      /------\
     /  API  \        (Some - Controller integration tests)
    /----------\
   /    Unit    \     (Many - Service logic tests)
  /--------------\
```

---

## 🧪 Test Coverage Plan

### Phase 1: Unit Tests (Services) - 60% coverage target
Focus on business logic and external API services.

#### Priority 1: Core Services ⭐⭐⭐
- [x] `CacheService` - Redis caching logic
- [ ] `MetricsService` - Performance tracking
- [ ] `CircuitBreakerService` - Resilience logic
- [ ] `ConfigValidationService` - Environment validation

#### Priority 2: External API Services ⭐⭐
- [ ] `AqicnService` - Air quality API
- [ ] `OpenWeatherService` - Temperature API
- [ ] `FirmsService` - Forest fire API
- [ ] `NoaaService` - Sea level API
- [ ] `NsidcService` - Ice extent API

#### Priority 3: Business Logic Services ⭐
- [ ] `AirQualityService` - DB queries
- [ ] `TemperatureService` - DB queries
- [ ] `ForestFireService` - DB queries
- [ ] `SeaLevelService` - DB queries
- [ ] `IceExtentService` - DB queries

---

### Phase 2: Integration Tests (Controllers) - 10% coverage target
Test HTTP endpoints and request/response handling.

- [ ] `AirQualityController` - GET /api/air-quality/*
- [ ] `TemperatureController` - GET /api/temperature/*
- [ ] `ForestFireController` - GET /api/forest-fires/*
- [ ] `SeaLevelController` - GET /api/sea-level/*
- [ ] `IceExtentController` - GET /api/ice-extent/*
- [ ] `HealthController` - GET /health/*
- [ ] `CircuitBreakerController` - GET /api/circuit-breaker/*

---

### Phase 3: E2E Tests - 5% coverage target
Test critical user journeys end-to-end.

- [ ] Data Collection Flow (Cron → External API → DB → Cache)
- [ ] API Query Flow (Request → Cache Check → DB → Response)
- [ ] Health Check Flow (Request → Check services → Response)
- [ ] Circuit Breaker Flow (Failures → Open → Half-Open → Close)

---

## 🛠️ Testing Tools & Libraries

### Core
- **Jest**: Test runner and assertion library
- **@nestjs/testing**: NestJS test utilities
- **ts-jest**: TypeScript support for Jest

### Mocking
- **jest.mock()**: Mock modules and dependencies
- **jest.spyOn()**: Spy on methods
- **jest.fn()**: Mock functions

### HTTP Testing
- **supertest**: HTTP assertions for E2E tests

### Database Testing
- **mongodb-memory-server**: In-memory MongoDB for tests
- **ioredis-mock**: Mock Redis client

---

## 📝 Testing Patterns

### 1. Unit Test Pattern (Services)

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: jest.Mocked<DependencyType>;

  beforeEach(async () => {
    // Create mock
    mockDependency = {
      method: jest.fn(),
    } as any;

    // Create test module
    const module = await Test.createTestingModule({
      providers: [
        ServiceName,
        { provide: DependencyName, useValue: mockDependency },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  it('should do something', async () => {
    // Arrange
    mockDependency.method.mockResolvedValue('result');

    // Act
    const result = await service.doSomething();

    // Assert
    expect(result).toBe('expected');
    expect(mockDependency.method).toHaveBeenCalled();
  });
});
```

### 2. Controller Test Pattern (Integration)

```typescript
describe('ControllerName', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/GET endpoint', () => {
    return request(app.getHttpServer())
      .get('/api/endpoint')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('data');
      });
  });
});
```

### 3. E2E Test Pattern

```typescript
describe('User Flow (E2E)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();

    // Create app
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongoServer.stop();
  });

  it('should complete full data collection flow', async () => {
    // Trigger collection
    await request(app.getHttpServer())
      .post('/api/collector/trigger/air-quality')
      .expect(200);

    // Query data
    const response = await request(app.getHttpServer())
      .get('/api/air-quality/hanoi')
      .expect(200);

    expect(response.body).toHaveProperty('aqi');
  });
});
```

---

## 🎯 Coverage Goals

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Services | 80% | High |
| Controllers | 70% | Medium |
| Utilities | 90% | Medium |
| Schemas | 50% | Low |
| Overall | **75%** | **Target** |

---

## ✅ Test Checklist

For each service/controller, test:

- ✅ **Happy path**: Normal successful execution
- ✅ **Error handling**: What happens when things fail
- ✅ **Edge cases**: Null, undefined, empty arrays
- ✅ **Validation**: Input validation works
- ✅ **Dependencies**: Mocked correctly
- ✅ **Side effects**: DB writes, cache updates, logs

---

## 🚀 Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run specific test file
npm test -- cache.service.spec.ts

# Run tests matching pattern
npm test -- --testNamePattern="CacheService"
```

---

## 📊 Current Status

### Completed ✅
- [x] Jest configuration
- [x] Test setup file
- [x] CacheService unit tests (100% coverage)

### In Progress 🔄
- [ ] MetricsService unit tests
- [ ] CircuitBreakerService unit tests

### Pending ⏳
- [ ] External API service tests
- [ ] Controller integration tests
- [ ] E2E tests

---

## 🎓 Best Practices

1. **Arrange-Act-Assert (AAA)**: Structure tests clearly
2. **One assertion per test**: Keep tests focused
3. **Descriptive names**: Test names explain what they test
4. **Mock external dependencies**: Don't call real APIs in tests
5. **Fast tests**: Tests should run in milliseconds
6. **Independent tests**: Each test can run alone
7. **Clean up**: Reset mocks, close connections

---

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Testing Best Practices](https://testingjavascript.com/)
