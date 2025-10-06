// Test setup file - runs before all tests

// Set test environment variables
process.env.NODE_ENV = '';
process.env.PORT = '';
process.env.MONGODB_URI = '';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Mock API tokens for testing
process.env.OPENWEATHER_API_KEY = '';
process.env.NASA_FIRMS_API_KEY = '';
process.env.AQICN_API_TOKEN = '';

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