import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { setupAxiosRetry } from '../../../config/http.config';
import { CircuitBreakerService } from './circuit-breaker.service';

export interface LocationData {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

export interface TemperatureResponse {
  location: string;
  country: string;
  temperature: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  pressure: number;
  weatherDescription: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  timestamp: Date;
}

@Injectable()
export class OpenWeatherService implements OnModuleInit {
  private readonly logger = new Logger(OpenWeatherService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
    
    if (!apiKey || apiKey === 'demo') {
      this.logger.error(
        '❌ OPENWEATHER_API_KEY not configured! ' +
        'Please get a free API key from https://openweathermap.org/api ' +
        'and set it in your .env file. Temperature data collection will fail without valid API key.'
      );
      throw new Error('OPENWEATHER_API_KEY is required. Please configure it in .env file.');
    }
    
    this.apiKey = apiKey;
    this.logger.log('✅ OpenWeatherMap API configured with valid key');
  }

  onModuleInit() {
    setupAxiosRetry(this.httpService.axiosRef, {
      retries: 3,
      retryDelay: 1000,
      onRetry: (retryCount, error) => {
        this.logger.warn(
          `OpenWeather API call failed, retry attempt ${retryCount}/3: ${error.message}`,
        );
      },
    });
    this.logger.log('✅ Retry mechanism configured for OpenWeather API');
  }

  async getTemperature(lat: number, lon: number): Promise<TemperatureResponse | null> {
    // Define the API call action
    const fetchAction = async (latitude: number, longitude: number) => {
      const url = `${this.baseUrl}/weather?lat=${latitude}&lon=${longitude}&appid=${this.apiKey}&units=metric`;
      const response = await firstValueFrom(this.httpService.get(url));
      const data = response.data;

      return {
        location: data.name,
        country: data.sys.country,
        temperature: data.main.temp,
        feelsLike: data.main.feels_like,
        tempMin: data.main.temp_min,
        tempMax: data.main.temp_max,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        weatherDescription: data.weather[0]?.description || '',
        coordinates: {
          lat: data.coord.lat,
          lon: data.coord.lon,
        },
        timestamp: new Date(data.dt * 1000),
      };
    };

    // Define fallback function
    const fallback = async (latitude: number, longitude: number) => {
      this.logger.warn(`🔄 Using fallback for coordinates ${latitude},${longitude} - circuit breaker open`);
      return null;
    };

    // Execute through circuit breaker
    try {
      return await this.circuitBreakerService.execute(
        'openweather',
        fetchAction,
        [lat, lon],
        fallback,
      );
    } catch (error) {
      this.logger.error(`Error fetching temperature for ${lat},${lon}:`, error.message);
      return null;
    }
  }

  // List of locations to monitor (MVP - 25 major cities worldwide)
  getLocationsForCollection(): LocationData[] {
    return [
      { name: 'Hanoi', country: 'VN', lat: 21.0285, lon: 105.8542 },
      { name: 'Ho Chi Minh City', country: 'VN', lat: 10.8231, lon: 106.6297 },
      { name: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503 },
      { name: 'Beijing', country: 'CN', lat: 39.9042, lon: 116.4074 },
      { name: 'Delhi', country: 'IN', lat: 28.7041, lon: 77.1025 },
      { name: 'Mumbai', country: 'IN', lat: 19.076, lon: 72.8777 },
      { name: 'Shanghai', country: 'CN', lat: 31.2304, lon: 121.4737 },
      { name: 'Singapore', country: 'SG', lat: 1.3521, lon: 103.8198 },
      { name: 'Bangkok', country: 'TH', lat: 13.7563, lon: 100.5018 },
      { name: 'Jakarta', country: 'ID', lat: -6.2088, lon: 106.8456 },
      { name: 'Seoul', country: 'KR', lat: 37.5665, lon: 126.978 },
      { name: 'London', country: 'GB', lat: 51.5074, lon: -0.1278 },
      { name: 'Paris', country: 'FR', lat: 48.8566, lon: 2.3522 },
      { name: 'Berlin', country: 'DE', lat: 52.52, lon: 13.405 },
      { name: 'New York', country: 'US', lat: 40.7128, lon: -74.006 },
      { name: 'Los Angeles', country: 'US', lat: 34.0522, lon: -118.2437 },
      { name: 'Chicago', country: 'US', lat: 41.8781, lon: -87.6298 },
      { name: 'Toronto', country: 'CA', lat: 43.6532, lon: -79.3832 },
      { name: 'Mexico City', country: 'MX', lat: 19.4326, lon: -99.1332 },
      { name: 'Sao Paulo', country: 'BR', lat: -23.5505, lon: -46.6333 },
      { name: 'Sydney', country: 'AU', lat: -33.8688, lon: 151.2093 },
      { name: 'Melbourne', country: 'AU', lat: -37.8136, lon: 144.9631 },
      { name: 'Moscow', country: 'RU', lat: 55.7558, lon: 37.6173 },
      { name: 'Dubai', country: 'AE', lat: 25.2048, lon: 55.2708 },
      { name: 'Cairo', country: 'EG', lat: 30.0444, lon: 31.2357 },
    ];
  }

  /**
   * Fetch historical temperature data for all cities within date range
   * 
   * IMPORTANT NOTE: OpenWeatherMap Free Plan does NOT support historical weather API.
   * Historical weather data requires One Call API 3.0 subscription ($40-200/month).
   * 
   * This method is implemented for future use when upgraded to paid plan.
   * For now, it will return empty array with warning.
   * 
   * Alternative approaches for MVP:
   * 1. Collect daily data going forward (build history over time)
   * 2. Use free alternative APIs like Open-Meteo for historical data
   * 3. Upgrade to OpenWeather One Call API subscription
   * 
   * @param fromDate Start date
   * @param toDate End date
   * @returns Array of temperature readings (empty for free tier)
   */
  async fetchHistoricalData(fromDate: Date, toDate: Date): Promise<any[]> {
    this.logger.warn(
      '⚠️  OpenWeatherMap Free Plan does not support historical weather data.',
    );
    this.logger.warn(
      '💡 Historical weather requires One Call API 3.0 subscription ($40-200/month).',
    );
    this.logger.warn(
      '📝 Consider: 1) Build history daily going forward, 2) Use Open-Meteo API (free), or 3) Upgrade plan',
    );

    // Check if we have One Call API access from environment variable
    const hasOneCallAPI = this.configService.get<string>('OPENWEATHER_ONE_CALL_ENABLED') === 'true';

    if (!hasOneCallAPI) {
      this.logger.log(
        'OpenWeather One Call API not enabled. To enable historical temperature collection, ' +
        'please upgrade to OpenWeather One Call API ($40-200/month) and set OPENWEATHER_ONE_CALL_ENABLED=true in .env'
      );
      return [];
    }

    // Future implementation for paid tier:
    this.logger.log(
      `Would fetch historical temperature data from ${fromDate.toISOString()} to ${toDate.toISOString()} for ${this.getLocationsForCollection().length} cities`,
    );

    const allData: any[] = [];
    const locations = this.getLocationsForCollection();

    // This would be the implementation if One Call API is available:
    /*
    for (const location of locations) {
      try {
        const url = `${this.baseUrl}/onecall/timemachine?lat=${location.lat}&lon=${location.lon}&dt=${Math.floor(fromDate.getTime() / 1000)}&appid=${this.apiKey}&units=metric`;
        
        const response = await firstValueFrom(this.httpService.get(url));
        const data = response.data;
        
        // Process and format data...
        allData.push(...formattedData);
        
        // Rate limiting
        await this.sleep(100);
      } catch (error) {
        this.logger.error(`Error fetching historical data for ${location.name}: ${error.message}`);
      }
    }
    */

    return allData;
  }

  /**
   * Alternative: Use Open-Meteo API for free historical weather data
   * Open-Meteo provides free historical weather data back to 1940
   * URL: https://archive-api.open-meteo.com/v1/archive
   */
  async fetchHistoricalDataFromOpenMeteo(
    fromDate: Date,
    toDate: Date,
  ): Promise<any[]> {
    this.logger.log(
      `Fetching historical temperature data from Open-Meteo API (FREE alternative)`,
    );

    const allData: any[] = [];
    const locations = this.getLocationsForCollection();
    let successCount = 0;
    let failCount = 0;

    // Format dates for Open-Meteo (YYYY-MM-DD)
    const startDate = fromDate.toISOString().split('T')[0];
    const endDate = toDate.toISOString().split('T')[0];

    for (const location of locations) {
      try {
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean&timezone=UTC`;

        this.logger.debug(
          `Fetching data for ${location.name} from Open-Meteo...`,
        );

        const response = await firstValueFrom(this.httpService.get(url));
        const data = response.data;

        if (data.daily && data.daily.time) {
          // Convert Open-Meteo format to our schema
          for (let i = 0; i < data.daily.time.length; i++) {
            allData.push({
              location: location.name, // Changed from 'city' to 'location' to match schema
              country: location.country,
              coordinates: {
                lat: location.lat,
                lon: location.lon,
              },
              temperature: data.daily.temperature_2m_mean[i],
              tempMin: data.daily.temperature_2m_min[i],
              tempMax: data.daily.temperature_2m_max[i],
              // Open-Meteo doesn't provide these, use defaults
              feelsLike: data.daily.temperature_2m_mean[i],
              humidity: null,
              pressure: null,
              weatherDescription: 'Historical data from Open-Meteo',
              timestamp: new Date(data.daily.time[i] + 'T12:00:00Z'),
              source: 'Open-Meteo',
            });
          }

          successCount++;
          this.logger.debug(
            `✓ ${location.name}: ${data.daily.time.length} days of data`,
          );
        } else {
          failCount++;
          this.logger.warn(`✗ ${location.name}: No data available`);
        }

        // Progress logging every 5 cities
        if ((successCount + failCount) % 5 === 0) {
          this.logger.log(
            `Progress: ${successCount + failCount}/${locations.length} cities (${Math.round(((successCount + failCount) / locations.length) * 100)}%)`,
          );
        }

        // Rate limiting (Open-Meteo allows 10,000 requests/day, so 1 request/100ms is safe)
        await this.sleep(100);
      } catch (error) {
        failCount++;
        this.logger.error(
          `Error fetching data for ${location.name}: ${error.message}`,
        );
        continue;
      }
    }

    this.logger.log(
      `Historical temperature collection completed: ${allData.length} total records from ${successCount} cities (${failCount} failed)`,
    );

    return allData;
  }

  /**
   * Helper function to sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
