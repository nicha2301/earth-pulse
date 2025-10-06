// Test setup file - runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.MONGODB_URI = 'mongodb+srv://nqt230103a:123456789trungAa%2E@earch-pulse.wtyuu8h.mongodb.net/earth-pulse?retryWrites=true&w=majority&appName=Earch-Pulse';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Mock API tokens for testing
process.env.OPENWEATHER_API_KEY = '33e923c9fbf8c049228a887164f175cd';
process.env.NASA_FIRMS_API_KEY = '6ae30be1e78c92c17ccfa1606cbabd62';
process.env.AQICN_API_TOKEN = 'f68d05992d185020fb3b8da45c44fb74d72a4584';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };