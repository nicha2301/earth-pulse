import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { setupAxiosRetry } from '../../../config/http.config';
import { CircuitBreakerService } from './circuit-breaker.service';

interface NOAAStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface NOAAResponse {
  metadata: {
    id: string;
    name: string;
    lat: string;
    lon: string;
  };
  data: Array<{
    t: string; // time
    v: string; // value (water level)
    s?: string; // sigma (standard deviation)
    f?: string; // flags
    q?: string; // quality
  }>;
}

@Injectable()
export class NoaaService implements OnModuleInit {
  private readonly logger = new Logger(NoaaService.name);
  private readonly baseUrl = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

  // 25 Major coastal stations worldwide
  private readonly stations: NOAAStation[] = [
    // US East Coast
    { id: '8518750', name: 'The Battery, NY', lat: 40.7006, lon: -74.0142 },
    { id: '8443970', name: 'Boston, MA', lat: 42.3535, lon: -71.0533 },
    { id: '8728690', name: 'Trident Pier, FL', lat: 28.4153, lon: -80.5933 },
    { id: '8729108', name: 'Miami Beach, FL', lat: 25.7683, lon: -80.13 },
    { id: '8658120', name: 'Wilmington, NC', lat: 34.2267, lon: -77.9531 },
    
    // US Gulf Coast
    { id: '8729840', name: 'Key West, FL', lat: 24.5511, lon: -81.8078 },
    { id: '8760922', name: 'Pilots Station East, TX', lat: 29.285, lon: -94.925 },
    { id: '8761724', name: 'Grand Isle, LA', lat: 29.2633, lon: -89.9567 },
    
    // US West Coast
    { id: '9414290', name: 'San Francisco, CA', lat: 37.8063, lon: -122.4659 },
    { id: '9410170', name: 'San Diego, CA', lat: 32.7142, lon: -117.1736 },
    { id: '9447130', name: 'Seattle, WA', lat: 47.6022, lon: -122.3394 },
    { id: '9413450', name: 'Alameda, CA', lat: 37.7717, lon: -122.2989 },
    { id: '9446484', name: 'Tacoma, WA', lat: 47.2667, lon: -122.4131 },
    
    // Alaska
    { id: '9455920', name: 'Juneau, AK', lat: 58.2983, lon: -134.4083 },
    { id: '9450460', name: 'Ketchikan, AK', lat: 55.3317, lon: -131.625 },
    
    // Hawaii
    { id: '1612340', name: 'Honolulu, HI', lat: 21.3067, lon: -157.867 },
    { id: '1617433', name: 'Nawiliwili, HI', lat: 21.9544, lon: -159.3562 },
    
    // US Territories
    { id: '9751364', name: 'San Juan, PR', lat: 18.459, lon: -66.1167 },
    { id: '9751639', name: 'Mayaguez, PR', lat: 18.22, lon: -67.16 },
    { id: '1630000', name: 'Apra Harbor, Guam', lat: 13.4417, lon: 144.6556 },
    
    // Great Lakes
    { id: '9063053', name: 'Detroit, MI', lat: 42.3233, lon: -83.0911 },
    { id: '9087044', name: 'Milwaukee, WI', lat: 43.0186, lon: -87.8881 },
    { id: '9075014', name: 'Sturgeon Bay, WI', lat: 44.7944, lon: -87.3139 },
    
    // Additional Strategic Locations
    { id: '8571421', name: 'Ocean City Inlet, MD', lat: 38.3283, lon: -75.0917 },
    { id: '8594900', name: 'Baltimore, MD', lat: 39.2667, lon: -76.5783 },
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  onModuleInit() {
    setupAxiosRetry(this.httpService.axiosRef, {
      retries: 3,
      retryDelay: 1000,
      onRetry: (retryCount, error) => {
        this.logger.warn(
          `NOAA API call failed, retry attempt ${retryCount}/3: ${error.message}`,
        );
      },
    });
    this.logger.log('✅ Retry mechanism configured for NOAA API');
  }

  /**
   * Get latest water level for a station
   */
  async getStationLatest(stationId: string): Promise<any> {
    // Define the API call action
    const fetchAction = async (station: string) => {
      const url = `${this.baseUrl}?station=${station}&product=water_level&date=latest&datum=MLLW&time_zone=gmt&units=metric&format=json&application=EarthPulse`;
      this.logger.debug(`Fetching latest data from NOAA: ${url}`);
      
      const response = await firstValueFrom(
        this.httpService.get<NOAAResponse>(url),
      );

      if (response.data && response.data.data && response.data.data.length > 0) {
        const latestData = response.data.data[0];
        
        return {
          stationId: response.data.metadata.id,
          stationName: response.data.metadata.name,
          locationType: 'Point',
          coordinates: [
            parseFloat(response.data.metadata.lon), // longitude first
            parseFloat(response.data.metadata.lat), // latitude second
          ],
          waterLevel: parseFloat(latestData.v),
          sigma: latestData.s ? parseFloat(latestData.s) : undefined,
          flags: latestData.f,
          quality: latestData.q,
          datum: 'MLLW',
          timestamp: new Date(latestData.t + 'Z'), // Add Z for UTC
          source: 'NOAA',
        };
      }

      return null;
    };

    // Define fallback function
    const fallback = async (station: string) => {
      this.logger.warn(`🔄 Using fallback for NOAA station ${station} - circuit breaker open`);
      return null;
    };

    // Execute through circuit breaker
    try {
      return await this.circuitBreakerService.execute(
        'noaa',
        fetchAction,
        [stationId],
        fallback,
      );
    } catch (error) {
      if (error.response?.data?.error) {
        this.logger.warn(
          `NOAA API error for station ${stationId}: ${error.response.data.error.message}`,
        );
      } else {
        this.logger.error(
          `Error fetching data for station ${stationId}: ${error.message}`,
        );
      }
      return null;
    }
  }

  /**
   * Get water level data for date range
   */
  async getStationHistory(
    stationId: string,
    beginDate: string,
    endDate: string,
  ): Promise<any[]> {
    try {
      // Format: yyyyMMdd HH:mm
      const begin = this.formatDateForNOAA(new Date(beginDate));
      const end = this.formatDateForNOAA(new Date(endDate));

      const url = `${this.baseUrl}?begin_date=${begin}&end_date=${end}&station=${stationId}&product=water_level&datum=MLLW&time_zone=gmt&units=metric&format=json&application=EarthPulse`;
      
      this.logger.debug(`Fetching history from NOAA: ${url}`);
      
      const response = await firstValueFrom(
        this.httpService.get<NOAAResponse>(url),
      );

      if (response.data && response.data.data) {
        return response.data.data.map((item) => ({
          stationId: response.data.metadata.id,
          stationName: response.data.metadata.name,
          locationType: 'Point',
          coordinates: [
            parseFloat(response.data.metadata.lon), // longitude first
            parseFloat(response.data.metadata.lat), // latitude second
          ],
          waterLevel: parseFloat(item.v),
          sigma: item.s ? parseFloat(item.s) : undefined,
          flags: item.f,
          quality: item.q,
          datum: 'MLLW',
          timestamp: new Date(item.t + 'Z'),
          source: 'NOAA',
        }));
      }

      return [];
    } catch (error) {
      this.logger.error(
        `Error fetching history for station ${stationId}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get all stations info
   */
  getAllStations(): NOAAStation[] {
    return this.stations;
  }

  /**
   * Get station info by ID
   */
  getStationInfo(stationId: string): NOAAStation | undefined {
    return this.stations.find((s) => s.id === stationId);
  }

  /**
   * Format date for NOAA API: yyyyMMdd HH:mm
   */
  private formatDateForNOAA(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    
    return `${year}${month}${day} ${hours}:${minutes}`;
  }

  /**
   * Get data for multiple stations in parallel
   */
  async getMultipleStations(stationIds: string[]): Promise<any[]> {
    this.logger.log(`Fetching data for ${stationIds.length} stations...`);
    
    const promises = stationIds.map((id) => this.getStationLatest(id));
    const results = await Promise.all(promises);
    
    // Filter out null results (failed requests)
    return results.filter((r) => r !== null);
  }

  /**
   * Get all 25 stations latest data
   */
  async getAllStationsLatest(): Promise<any[]> {
    const stationIds = this.stations.map((s) => s.id);
    return this.getMultipleStations(stationIds);
  }

  /**
   * Fetch historical data for all stations within date range
   * @param fromDate Start date
   * @param toDate End date
   * @returns Array of all water level readings from all stations
   */
  async fetchHistoricalData(fromDate: Date, toDate: Date): Promise<any[]> {
    this.logger.log(
      `Fetching historical sea level data from ${fromDate.toISOString()} to ${toDate.toISOString()} for ${this.stations.length} stations`,
    );

    const allData: any[] = [];
    let processedStations = 0;
    let successfulStations = 0;
    let failedStations = 0;

    // Process stations sequentially to respect NOAA API rate limits
    // NOAA recommends no more than 10 requests per second
    for (const station of this.stations) {
      try {
        this.logger.debug(
          `Fetching data for station ${station.id} (${station.name})...`,
        );

        const beginDate = fromDate.toISOString().split('T')[0];
        const endDate = toDate.toISOString().split('T')[0];

        const stationData = await this.getStationHistory(
          station.id,
          beginDate,
          endDate,
        );

        if (stationData && stationData.length > 0) {
          allData.push(...stationData);
          successfulStations++;
          this.logger.debug(
            `✓ Station ${station.id}: ${stationData.length} records`,
          );
        } else {
          failedStations++;
          this.logger.warn(
            `✗ Station ${station.id}: No data available for date range`,
          );
        }

        processedStations++;

        // Progress logging every 5 stations
        if (processedStations % 5 === 0) {
          this.logger.log(
            `Progress: ${processedStations}/${this.stations.length} stations (${Math.round((processedStations / this.stations.length) * 100)}%)`,
          );
        }

        // Delay between requests to respect rate limits (100ms = 10 requests/second max)
        await this.sleep(100);
      } catch (error) {
        failedStations++;
        this.logger.error(
          `Error fetching data for station ${station.id} (${station.name}): ${error.message}`,
        );
        
        // Continue with next station even if this one fails
        continue;
      }
    }

    this.logger.log(
      `Historical data collection completed: ${allData.length} total records from ${successfulStations} stations (${failedStations} failed)`,
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
