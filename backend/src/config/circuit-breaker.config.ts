import * as CircuitBreaker from 'opossum';

/**
 * Circuit Breaker Configuration
 * 
 * Circuit breaker pattern prevents cascading failures by:
 * 1. Monitoring failed requests
 * 2. Opening circuit after threshold
 * 3. Preventing requests when open
 * 4. Testing with half-open state
 * 5. Closing when service recovers
 */

export interface CircuitBreakerConfig {
  timeout: number;              // Request timeout (ms)
  errorThresholdPercentage: number;  // % of errors to open circuit
  resetTimeout: number;         // Time before trying half-open (ms)
  rollingCountTimeout: number;  // Time window for error calculation (ms)
  rollingCountBuckets: number;  // Number of buckets in window
  volumeThreshold: number;      // Min requests before calculating error rate
  capacity: number;             // Max concurrent requests
  name?: string;                // Circuit breaker name for logging
}

/**
 * Default circuit breaker configuration
 * Tuned for external API calls with reasonable timeouts
 */
export const defaultCircuitBreakerConfig: CircuitBreakerConfig = {
  timeout: 10000,                    // 10 seconds timeout
  errorThresholdPercentage: 50,      // Open circuit if >50% errors
  resetTimeout: 30000,               // Try half-open after 30 seconds
  rollingCountTimeout: 10000,        // 10 second error calculation window
  rollingCountBuckets: 10,           // 10 buckets of 1 second each
  volumeThreshold: 5,                // Need at least 5 requests
  capacity: 10,                      // Max 10 concurrent requests
};

/**
 * Service-specific configurations
 * Each external API may need different timeouts and thresholds
 */
export const circuitBreakerConfigs: Record<string, CircuitBreakerConfig> = {
  // Air Quality API - Usually fast, low timeout
  aqicn: {
    ...defaultCircuitBreakerConfig,
    timeout: 8000,              // 8 seconds
    errorThresholdPercentage: 40,  // More sensitive
    name: 'AQICN Circuit Breaker',
  },

  // OpenWeather API - Fast and reliable
  openweather: {
    ...defaultCircuitBreakerConfig,
    timeout: 8000,              // 8 seconds
    errorThresholdPercentage: 40,
    name: 'OpenWeather Circuit Breaker',
  },

  // NASA FIRMS - Can be slower with large datasets
  firms: {
    ...defaultCircuitBreakerConfig,
    timeout: 15000,             // 15 seconds
    errorThresholdPercentage: 50,
    volumeThreshold: 3,         // Lower threshold for less frequent calls
    name: 'NASA FIRMS Circuit Breaker',
  },

  // NOAA API - Government API, can be slower
  noaa: {
    ...defaultCircuitBreakerConfig,
    timeout: 15000,             // 15 seconds
    errorThresholdPercentage: 50,
    resetTimeout: 60000,        // Wait 60 seconds before retry
    name: 'NOAA Circuit Breaker',
  },

  // NSIDC API - Large CSV files, needs longer timeout
  nsidc: {
    ...defaultCircuitBreakerConfig,
    timeout: 20000,             // 20 seconds
    errorThresholdPercentage: 50,
    resetTimeout: 60000,        // Wait 60 seconds before retry
    volumeThreshold: 3,
    name: 'NSIDC Circuit Breaker',
  },
};

/**
 * Circuit Breaker Events
 * Used for logging and monitoring
 */
export const CircuitBreakerEvents = {
  SUCCESS: 'success',           // Request succeeded
  FAILURE: 'failure',           // Request failed
  TIMEOUT: 'timeout',           // Request timed out
  OPEN: 'open',                 // Circuit opened (failing)
  CLOSE: 'close',               // Circuit closed (healthy)
  HALF_OPEN: 'halfOpen',        // Circuit testing recovery
  FALLBACK: 'fallback',         // Fallback function executed
  SEMAPHORE_LOCKED: 'semaphoreLocked',  // Too many concurrent requests
  HEALTH_CHECK_FAILED: 'healthCheckFailed',
};

/**
 * Create a circuit breaker with custom configuration
 */
export function createCircuitBreaker<T extends any[], R>(
  action: (...args: T) => Promise<R>,
  config: Partial<CircuitBreakerConfig> = {},
): CircuitBreaker<T, R> {
  const finalConfig = {
    ...defaultCircuitBreakerConfig,
    ...config,
  };

  const options: CircuitBreaker.Options = {
    timeout: finalConfig.timeout,
    errorThresholdPercentage: finalConfig.errorThresholdPercentage,
    resetTimeout: finalConfig.resetTimeout,
    rollingCountTimeout: finalConfig.rollingCountTimeout,
    rollingCountBuckets: finalConfig.rollingCountBuckets,
    volumeThreshold: finalConfig.volumeThreshold,
    capacity: finalConfig.capacity,
    name: finalConfig.name || 'Circuit Breaker',
  };

  return new CircuitBreaker(action, options) as CircuitBreaker<T, R>;
}

/**
 * Helper to check if error should trigger circuit breaker
 */
export function isCircuitBreakerError(error: any): boolean {
  // Network errors
  if (error.code && ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNABORTED'].includes(error.code)) {
    return true;
  }

  // HTTP errors
  if (error.response) {
    const status = error.response.status;
    // 5xx server errors should trigger circuit breaker
    if (status >= 500 && status < 600) {
      return true;
    }
    // 429 rate limit might indicate service issues
    if (status === 429) {
      return true;
    }
  }

  // Timeout errors
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return true;
  }

  return false;
}
