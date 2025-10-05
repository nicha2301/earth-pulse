import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface FirmsFireData {
  latitude: number;
  longitude: number;
  brightness: number;
  scan: number;
  track: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  instrument: string;
  confidence: number | string;
  version: string;
  bright_t31: number;
  frp: number;
  daynight: string;
  type?: number; // Optional fire type field
}

@Injectable()
export class FirmsArchiveService {
  private readonly logger = new Logger(FirmsArchiveService.name);
  private readonly mapKey: string;
  private readonly baseUrl = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.mapKey = this.configService.get<string>('FIRMS_MAP_KEY') || '';
    if (!this.mapKey) {
      this.logger.warn('FIRMS_MAP_KEY not configured in environment');
    }
  }

  /**
   * Download fire data for a specific date range (max 10 days)
   * @param source 'MODIS_NRT' | 'VIIRS_SNPP_NRT' | 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT'
   * @param startDate YYYY-MM-DD format
   * @param days Number of days (max 10)
   * @returns CSV string
   */
  async downloadArchiveCSV(
    source: string,
    startDate: string,
    days: number = 10,
  ): Promise<string> {
    // Cap at 10 days (API limit)
    const actualDays = Math.min(days, 10);
    
    // Area: WORLD = global coverage
    const url = `${this.baseUrl}/${this.mapKey}/${source}/WORLD/${actualDays}/${startDate}`;
    
    this.logger.log(`Downloading: ${source} from ${startDate} (${actualDays} days)`);
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 120000, // 120 second timeout for large downloads
          responseType: 'text',
        }),
      );
      
      const csvData = response.data;
      
      // Check for API errors
      if (typeof csvData === 'string' && csvData.includes('Error')) {
        throw new Error(`API Error: ${csvData}`);
      }
      
      // Check if no data available
      if (typeof csvData === 'string' && csvData.trim().length === 0) {
        this.logger.warn(`No fire data available for ${source} from ${startDate}`);
        return '';
      }
      
      return csvData;
    } catch (error) {
      this.logger.error(`Download failed for ${startDate}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse CSV string into fire data objects
   * @param csvString Raw CSV data from FIRMS API
   * @returns Array of fire data objects
   */
  parseCSV(csvString: string): FirmsFireData[] {
    if (!csvString || csvString.trim().length === 0) {
      return [];
    }

    const lines = csvString.trim().split('\n');
    
    // Need at least header + 1 data row
    if (lines.length < 2) {
      return [];
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const fires: FirmsFireData[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',');
        if (values.length < headers.length) {
          this.logger.warn(`Skipping malformed line ${i}: insufficient columns`);
          continue;
        }

        const fire: any = {};
        headers.forEach((header, index) => {
          fire[header] = values[index]?.trim();
        });

        // Convert to FirmsFireData format with type safety
        const parsedFire: FirmsFireData = {
          latitude: parseFloat(fire.latitude),
          longitude: parseFloat(fire.longitude),
          brightness: parseFloat(fire.brightness),
          scan: parseFloat(fire.scan),
          track: parseFloat(fire.track),
          acq_date: fire.acq_date,
          acq_time: fire.acq_time,
          satellite: fire.satellite,
          instrument: fire.instrument,
          confidence: this.parseConfidence(fire.confidence),
          version: fire.version,
          bright_t31: parseFloat(fire.bright_t31),
          frp: parseFloat(fire.frp),
          daynight: fire.daynight,
          type: fire.type ? parseFloat(fire.type) : undefined,
        };

        // Validate required fields
        if (
          isNaN(parsedFire.latitude) ||
          isNaN(parsedFire.longitude) ||
          !parsedFire.acq_date ||
          !parsedFire.acq_time
        ) {
          this.logger.warn(`Skipping invalid fire at line ${i}: missing required fields`);
          continue;
        }

        fires.push(parsedFire);
      } catch (error) {
        this.logger.error(`Error parsing line ${i}: ${error.message}`);
      }
    }

    return fires;
  }

  /**
   * Parse confidence value (can be numeric or string like "nominal", "low", "high")
   */
  private parseConfidence(value: string): number | string {
    const numeric = parseFloat(value);
    if (!isNaN(numeric)) {
      return numeric;
    }
    return value; // Return string value (e.g., "nominal", "low", "high")
  }

  /**
   * Generate list of date ranges for bulk download
   * Splits time period into 10-day chunks for API compatibility
   * @param startYear 2000 (MODIS) or 2012 (VIIRS)
   * @param endYear Current year
   * @returns Array of { startDate, days } objects
   */
  generateDateRanges(
    startYear: number,
    endYear: number,
  ): Array<{ startDate: string; days: number }> {
    const ranges: Array<{ startDate: string; days: number }> = [];
    const startDate = new Date(startYear, 0, 1); // January 1st
    const endDate = new Date(endYear, 11, 31); // December 31st
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Calculate days remaining
      const remainingTime = endDate.getTime() - currentDate.getTime();
      const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
      const daysToFetch = Math.min(10, remainingDays + 1);
      
      ranges.push({ 
        startDate: dateStr, 
        days: daysToFetch 
      });
      
      // Move forward 10 days
      currentDate.setDate(currentDate.getDate() + 10);
    }
    
    this.logger.log(`Generated ${ranges.length} date ranges from ${startYear} to ${endYear}`);
    return ranges;
  }

  /**
   * Get recommended satellite source based on year
   * @param year Year to check
   * @returns Recommended satellite source
   */
  getRecommendedSource(year: number): string {
    if (year >= 2024) {
      return 'VIIRS_NOAA21_NRT'; // Latest satellite
    } else if (year >= 2018) {
      return 'VIIRS_NOAA20_NRT'; // NOAA-20 from 2018
    } else if (year >= 2012) {
      return 'VIIRS_SNPP_NRT'; // VIIRS from 2012
    } else {
      return 'MODIS_NRT'; // MODIS from 2000
    }
  }

  /**
   * Get satellite data availability info
   */
  getSatelliteInfo(): Record<string, { startYear: number; name: string; resolution: string }> {
    return {
      MODIS_NRT: {
        startYear: 2000,
        name: 'MODIS Collection 6.1',
        resolution: '1km',
      },
      VIIRS_SNPP_NRT: {
        startYear: 2012,
        name: 'VIIRS S-NPP',
        resolution: '375m',
      },
      VIIRS_NOAA20_NRT: {
        startYear: 2018,
        name: 'VIIRS NOAA-20',
        resolution: '375m',
      },
      VIIRS_NOAA21_NRT: {
        startYear: 2024,
        name: 'VIIRS NOAA-21',
        resolution: '375m',
      },
    };
  }

  /**
   * Estimate total fires for a given year range
   * This is a rough estimate based on average daily fire activity
   */
  estimateFireCount(startYear: number, endYear: number): {
    estimatedFires: number;
    estimatedSizeMB: number;
    estimatedTimeMinutes: number;
  } {
    const years = endYear - startYear + 1;
    const avgFiresPerDay = 5000; // Conservative estimate
    const daysPerYear = 365;
    
    const estimatedFires = years * daysPerYear * avgFiresPerDay;
    const bytesPerFire = 200; // Average record size
    const estimatedSizeMB = (estimatedFires * bytesPerFire) / (1024 * 1024);
    
    // Estimate processing time (1000 fires/second, plus API delays)
    const processingTimeSeconds = estimatedFires / 1000;
    const apiDelaySeconds = years * 37 * 2; // 37 requests per year, 2 seconds each
    const estimatedTimeMinutes = (processingTimeSeconds + apiDelaySeconds) / 60;
    
    return {
      estimatedFires: Math.round(estimatedFires),
      estimatedSizeMB: Math.round(estimatedSizeMB),
      estimatedTimeMinutes: Math.round(estimatedTimeMinutes),
    };
  }

  /**
   * Parse CSV file from buffer (for file uploads)
   * More efficient than string parsing for large files
   * @param buffer File buffer from uploaded CSV
   * @returns Array of fire data objects
   */
  parseCSVFromBuffer(buffer: Buffer): FirmsFireData[] {
    const csvString = buffer.toString('utf-8');
    return this.parseCSV(csvString);
  }

  /**
   * Parse CSV file with streaming for very large files
   * Returns data in chunks to avoid memory issues
   * @param csvString Raw CSV data
   * @param chunkSize Number of rows per chunk
   */
  *parseCSVInChunks(
    csvString: string,
    chunkSize: number = 10000,
  ): Generator<FirmsFireData[]> {
    const lines = csvString.trim().split('\n');
    
    if (lines.length < 2) {
      return;
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    let chunk: FirmsFireData[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',');
        if (values.length < headers.length) {
          continue;
        }

        const fire: any = {};
        headers.forEach((header, index) => {
          fire[header] = values[index]?.trim();
        });

        const parsedFire: FirmsFireData = {
          latitude: parseFloat(fire.latitude),
          longitude: parseFloat(fire.longitude),
          brightness: parseFloat(fire.brightness),
          scan: parseFloat(fire.scan),
          track: parseFloat(fire.track),
          acq_date: fire.acq_date,
          acq_time: fire.acq_time,
          satellite: fire.satellite,
          instrument: fire.instrument,
          confidence: this.parseConfidence(fire.confidence),
          version: fire.version,
          bright_t31: parseFloat(fire.bright_t31),
          frp: parseFloat(fire.frp),
          daynight: fire.daynight,
          type: fire.type ? parseFloat(fire.type) : undefined,
        };

        if (
          isNaN(parsedFire.latitude) ||
          isNaN(parsedFire.longitude) ||
          !parsedFire.acq_date ||
          !parsedFire.acq_time
        ) {
          continue;
        }

        chunk.push(parsedFire);

        if (chunk.length >= chunkSize) {
          yield chunk;
          chunk = [];
        }
      } catch (error) {
        this.logger.error(`Error parsing line ${i}: ${error.message}`);
      }
    }

    if (chunk.length > 0) {
      yield chunk;
    }
  }

  /**
   * Validate CSV file format before processing
   */
  validateCSVFormat(buffer: Buffer): {
    isValid: boolean;
    error?: string;
    estimatedRows?: number;
  } {
    try {
      const csvString = buffer.toString('utf-8');
      const lines = csvString.trim().split('\n');

      if (lines.length < 2) {
        return {
          isValid: false,
          error: 'File is empty or contains only headers',
        };
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const requiredHeaders = [
        'latitude',
        'longitude',
        'brightness',
        'acq_date',
        'acq_time',
        'satellite',
      ];

      const missingHeaders = requiredHeaders.filter(
        h => !headers.includes(h),
      );

      if (missingHeaders.length > 0) {
        return {
          isValid: false,
          error: `Missing required headers: ${missingHeaders.join(', ')}`,
        };
      }

      return {
        isValid: true,
        estimatedRows: lines.length - 1,
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to read file: ${error.message}`,
      };
    }
  }
}
