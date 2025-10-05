import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NsidcService } from './nsidc.service';
import { NoaaService } from './noaa.service';
import { OpenWeatherService } from './openweather.service';
import { FirmsService } from './firms.service';
import { FirmsArchiveService } from './firms-archive.service';
import { IceExtent } from '../schemas/ice-extent.schema';
import { SeaLevel } from '../schemas/sea-level.schema';
import { Temperature } from '../schemas/temperature.schema';
import { ForestFire } from '../schemas/forest-fire.schema';
import { AirQuality } from '../schemas/air-quality.schema';

export interface CollectionProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  module: string;
  startTime?: Date;
  endTime?: Date;
  totalItems: number;
  processedItems: number;
  savedItems: number;
  duplicateSkipped: number;
  errors: number;
  errorMessages: string[];
  progressPercent: number;
}

export interface CollectionResult {
  success: boolean;
  message: string;
  details: CollectionProgress;
}

@Injectable()
export class HistoricalCollectorService {
  private readonly logger = new Logger(HistoricalCollectorService.name);
  private progressTracking: Map<string, CollectionProgress> = new Map();

  constructor(
    @InjectModel(IceExtent.name) private iceExtentModel: Model<IceExtent>,
    @InjectModel(SeaLevel.name) private seaLevelModel: Model<SeaLevel>,
    @InjectModel(Temperature.name) private temperatureModel: Model<Temperature>,
    @InjectModel(ForestFire.name) private forestFireModel: Model<ForestFire>,
    @InjectModel(AirQuality.name) private airQualityModel: Model<AirQuality>,
    private readonly nsidcService: NsidcService,
    private readonly noaaService: NoaaService,
    private readonly openWeatherService: OpenWeatherService,
    private readonly firmsService: FirmsService,
    private readonly firmsArchiveService: FirmsArchiveService,
  ) {}

  /**
   * Collect historical Ice Extent data
   * @param years Number of years to collect (default: 5)
   */
  async collectIceExtentHistorical(years = 5): Promise<CollectionResult> {
    const taskId = `ice-extent-${Date.now()}`;
    const progress: CollectionProgress = {
      status: 'running',
      module: 'Ice Extent',
      startTime: new Date(),
      totalItems: 0,
      processedItems: 0,
      savedItems: 0,
      duplicateSkipped: 0,
      errors: 0,
      errorMessages: [],
      progressPercent: 0,
    };

    this.progressTracking.set(taskId, progress);
    this.logger.log(`Starting Ice Extent historical collection: ${years} years`);

    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setFullYear(fromDate.getFullYear() - years);

      // Fetch data for both Arctic and Antarctic
      const [arcticData, antarcticData] = await Promise.all([
        this.nsidcService.getHistoricalExtent('Arctic', fromDate, toDate),
        this.nsidcService.getHistoricalExtent('Antarctic', fromDate, toDate),
      ]);

      const allData = [...arcticData, ...antarcticData];
      progress.totalItems = allData.length;
      this.logger.log(`Fetched ${allData.length} ice extent records`);

      // Process in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < allData.length; i += batchSize) {
        const batch = allData.slice(i, i + batchSize);

        for (const item of batch) {
          try {
            // Check if record already exists
            const existing = await this.iceExtentModel.findOne({
              region: item.region,
              date: item.date,
            });

            if (existing) {
              progress.duplicateSkipped++;
            } else {
              // Save new record
              await this.iceExtentModel.create({
                region: item.region,
                hemisphere: item.hemisphere,
                date: item.date,
                extent: item.extent,
                missing: item.missing,
                source: item.source,
                timestamp: new Date(),
              });
              progress.savedItems++;
            }

            progress.processedItems++;
            progress.progressPercent = Math.round(
              (progress.processedItems / progress.totalItems) * 100,
            );
          } catch (error) {
            progress.errors++;
            progress.errorMessages.push(`Error saving record: ${error.message}`);
            this.logger.error(`Error saving ice extent record: ${error.message}`);
          }
        }

        // Log progress every batch
        this.logger.log(
          `Progress: ${progress.processedItems}/${progress.totalItems} (${progress.progressPercent}%) - Saved: ${progress.savedItems}, Duplicates: ${progress.duplicateSkipped}, Errors: ${progress.errors}`,
        );

        // Small delay to avoid overwhelming the database
        await this.sleep(100);
      }

      progress.status = 'completed';
      progress.endTime = new Date();
      const duration = progress.startTime 
        ? (progress.endTime.getTime() - progress.startTime.getTime()) / 1000
        : 0;

      this.logger.log(
        `Ice Extent historical collection completed in ${duration}s. Saved: ${progress.savedItems}, Duplicates: ${progress.duplicateSkipped}, Errors: ${progress.errors}`,
      );

      return {
        success: true,
        message: `Successfully collected ${years} years of Ice Extent data`,
        details: progress,
      };
    } catch (error) {
      progress.status = 'error';
      progress.endTime = new Date();
      progress.errorMessages.push(error.message);

      this.logger.error(`Ice Extent historical collection failed: ${error.message}`);

      return {
        success: false,
        message: `Failed to collect Ice Extent data: ${error.message}`,
        details: progress,
      };
    } finally {
      // Clean up tracking after 1 hour
      setTimeout(() => this.progressTracking.delete(taskId), 3600000);
    }
  }

  /**
   * Collect historical Sea Level data
   * @param months Number of months to collect (default: 24)
   * Fetches hourly water level data from 25 NOAA stations
   */
  async collectSeaLevelHistorical(months = 24): Promise<CollectionResult> {
    const taskId = `sea-level-${Date.now()}`;
    const progress: CollectionProgress = {
      status: 'running',
      module: 'Sea Level',
      startTime: new Date(),
      totalItems: 0,
      processedItems: 0,
      savedItems: 0,
      duplicateSkipped: 0,
      errors: 0,
      errorMessages: [],
      progressPercent: 0,
    };

    this.progressTracking.set(taskId, progress);
    this.logger.log(`Starting Sea Level historical collection: ${months} months`);

    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - months);

      // Fetch historical data from NOAA for all 25 stations
      const historicalData = await this.noaaService.fetchHistoricalData(fromDate, toDate);
      progress.totalItems = historicalData.length;
      this.logger.log(`Fetched ${historicalData.length} sea level records from NOAA`);

      if (historicalData.length === 0) {
        progress.status = 'completed';
        progress.endTime = new Date();
        
        return {
          success: true,
          message: `No historical data available for the specified period`,
          details: progress,
        };
      }

      // Process in batches to avoid overwhelming the database
      const batchSize = 100;
      for (let i = 0; i < historicalData.length; i += batchSize) {
        const batch = historicalData.slice(i, i + batchSize);

        for (const item of batch) {
          try {
            // Check if record already exists
            const existing = await this.seaLevelModel.findOne({
              stationId: item.stationId,
              timestamp: item.timestamp,
            });

            if (existing) {
              progress.duplicateSkipped++;
            } else {
              // Save new record
              await this.seaLevelModel.create(item);
              progress.savedItems++;
            }

            progress.processedItems++;
            progress.progressPercent = Math.round(
              (progress.processedItems / progress.totalItems) * 100,
            );
          } catch (error) {
            progress.errors++;
            progress.errorMessages.push(
              `Error saving station ${item.stationId}: ${error.message}`,
            );
            this.logger.error(`Error saving sea level record: ${error.message}`);
          }
        }

        // Log progress every batch
        this.logger.log(
          `Progress: ${progress.processedItems}/${progress.totalItems} (${progress.progressPercent}%) - Saved: ${progress.savedItems}, Duplicates: ${progress.duplicateSkipped}, Errors: ${progress.errors}`,
        );

        // Small delay between batches
        await this.sleep(100);
      }

      progress.status = 'completed';
      progress.endTime = new Date();
      const duration = progress.startTime
        ? (progress.endTime.getTime() - progress.startTime.getTime()) / 1000
        : 0;

      this.logger.log(
        `Sea Level historical collection completed in ${duration}s. Saved: ${progress.savedItems}, Duplicates: ${progress.duplicateSkipped}, Errors: ${progress.errors}`,
      );

      return {
        success: true,
        message: `Successfully collected ${months} months of Sea Level data`,
        details: progress,
      };


    } catch (error) {
      progress.status = 'error';
      progress.endTime = new Date();
      progress.errorMessages.push(error.message);

      this.logger.error(`Sea Level historical collection failed: ${error.message}`);

      return {
        success: false,
        message: `Failed to collect Sea Level data: ${error.message}`,
        details: progress,
      };
    } finally {
      setTimeout(() => this.progressTracking.delete(taskId), 3600000);
    }
  }

  /**
   * Collect historical Temperature data
   * @param months Number of months to collect (default: 12)
   * Uses Open-Meteo API (free alternative) for historical weather data
   */
  async collectTemperatureHistorical(months = 12): Promise<CollectionResult> {
    const taskId = `temperature-${Date.now()}`;
    const progress: CollectionProgress = {
      status: 'running',
      module: 'Temperature',
      startTime: new Date(),
      totalItems: 0,
      processedItems: 0,
      savedItems: 0,
      duplicateSkipped: 0,
      errors: 0,
      errorMessages: [],
      progressPercent: 0,
    };

    this.progressTracking.set(taskId, progress);
    this.logger.log(`Starting Temperature historical collection: ${months} months`);

    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - months);

      // Use Open-Meteo API (free) instead of OpenWeatherMap (requires paid plan)
      this.logger.log('Using Open-Meteo API for historical temperature data (FREE alternative)');
      const historicalData = await this.openWeatherService.fetchHistoricalDataFromOpenMeteo(
        fromDate,
        toDate,
      );
      
      progress.totalItems = historicalData.length;
      this.logger.log(`Fetched ${historicalData.length} temperature records from Open-Meteo`);

      if (historicalData.length === 0) {
        progress.status = 'completed';
        progress.endTime = new Date();
        
        return {
          success: true,
          message: `No historical data available for the specified period`,
          details: progress,
        };
      }

      // Process in batches
      const batchSize = 100;
      for (let i = 0; i < historicalData.length; i += batchSize) {
        const batch = historicalData.slice(i, i + batchSize);

        for (const item of batch) {
          try {
            // Check if record already exists
            const existing = await this.temperatureModel.findOne({
              location: item.location,
              timestamp: item.timestamp,
            });

            if (existing) {
              progress.duplicateSkipped++;
            } else {
              // Save new record
              await this.temperatureModel.create(item);
              progress.savedItems++;
            }

            progress.processedItems++;
            progress.progressPercent = Math.round(
              (progress.processedItems / progress.totalItems) * 100,
            );
          } catch (error) {
            progress.errors++;
            progress.errorMessages.push(
              `Error saving location ${item.location}: ${error.message}`,
            );
            this.logger.error(`Error saving temperature record: ${error.message}`);
          }
        }

        // Log progress
        this.logger.log(
          `Progress: ${progress.processedItems}/${progress.totalItems} (${progress.progressPercent}%) - Saved: ${progress.savedItems}, Duplicates: ${progress.duplicateSkipped}, Errors: ${progress.errors}`,
        );

        // Small delay between batches
        await this.sleep(100);
      }

      progress.status = 'completed';
      progress.endTime = new Date();
      const duration = progress.startTime
        ? (progress.endTime.getTime() - progress.startTime.getTime()) / 1000
        : 0;

      this.logger.log(
        `Temperature historical collection completed in ${duration}s. Saved: ${progress.savedItems}, Duplicates: ${progress.duplicateSkipped}, Errors: ${progress.errors}`,
      );

      return {
        success: true,
        message: `Successfully collected ${months} months of Temperature data using Open-Meteo API`,
        details: progress,
      };
    } catch (error) {
      progress.status = 'error';
      progress.endTime = new Date();
      progress.errorMessages.push(error.message);

      this.logger.error(`Temperature historical collection failed: ${error.message}`);

      return {
        success: false,
        message: `Failed to collect Temperature data: ${error.message}`,
        details: progress,
      };
    } finally {
      setTimeout(() => this.progressTracking.delete(taskId), 3600000);
    }
  }

  /**
   * Collect historical Forest Fire data
   * @param days Number of days to collect (default: 10, max: 10 due to API limitation)
   * NOTE: NASA FIRMS standard API only supports last 10 days
   * For older data, we fetch what's available and log a warning
   */
  async collectForestFireHistorical(days = 10): Promise<CollectionResult> {
    const taskId = `forest-fire-${Date.now()}`;
    const progress: CollectionProgress = {
      status: 'running',
      module: 'Forest Fire',
      startTime: new Date(),
      totalItems: 0,
      processedItems: 0,
      savedItems: 0,
      duplicateSkipped: 0,
      errors: 0,
      errorMessages: [],
      progressPercent: 0,
    };

    this.progressTracking.set(taskId, progress);
    
    // Ensure days is within API limits (max 10 days)
    const daysToCollect = Math.min(Math.max(1, days), 10);
    
    this.logger.log(`Starting Forest Fire historical collection: ${daysToCollect} days`);

    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysToCollect);

      // Fetch historical data from FIRMS
      this.logger.log('Fetching fire data from NASA FIRMS...');
      const historicalData = await this.firmsService.fetchHistoricalData(
        fromDate,
        toDate,
        'VIIRS_SNPP_NRT',
      );

      progress.totalItems = historicalData.length;
      this.logger.log(`Fetched ${historicalData.length} fire records from FIRMS`);

      if (historicalData.length === 0) {
        progress.status = 'completed';
        progress.endTime = new Date();

        return {
          success: true,
          message: `No fire data available for the last ${daysToCollect} days`,
          details: progress,
        };
      }

      // Process in batches
      const batchSize = 100;
      for (let i = 0; i < historicalData.length; i += batchSize) {
        const batch = historicalData.slice(i, i + batchSize);

        for (const item of batch) {
          try {
            // Convert fire data to our schema format
            const fireRecord = {
              latitude: item.latitude,
              longitude: item.longitude,
              brightness: item.brightness,
              confidence: item.confidence,
              frp: item.frp,
              satellite: item.satellite,
              instrument: item.instrument,
              acq_date: item.acq_date,
              acq_time: item.acq_time,
              daynight: item.daynight,
              timestamp: new Date(`${item.acq_date}T${item.acq_time.slice(0, 2)}:${item.acq_time.slice(2, 4)}:00Z`),
              source: 'NASA FIRMS',
              coordinates: {
                lat: item.latitude,
                lon: item.longitude,
              },
            };

            // Check if record already exists (check by coordinates, date, and time)
            const existing = await this.forestFireModel.findOne({
              latitude: fireRecord.latitude,
              longitude: fireRecord.longitude,
              acq_date: fireRecord.acq_date,
              acq_time: fireRecord.acq_time,
            });

            if (existing) {
              progress.duplicateSkipped++;
            } else {
              // Save new record
              await this.forestFireModel.create(fireRecord);
              progress.savedItems++;
            }

            progress.processedItems++;
            progress.progressPercent = Math.round(
              (progress.processedItems / progress.totalItems) * 100,
            );
          } catch (error) {
            progress.errors++;
            progress.errorMessages.push(
              `Error saving fire record at ${item.latitude},${item.longitude}: ${error.message}`,
            );
            this.logger.error(`Error saving fire record: ${error.message}`);
          }
        }

        // Log progress every batch
        this.logger.log(
          `Progress: ${progress.processedItems}/${progress.totalItems} (${progress.progressPercent}%) - Saved: ${progress.savedItems}, Duplicates: ${progress.duplicateSkipped}, Errors: ${progress.errors}`,
        );

        // Small delay between batches
        await this.sleep(100);
      }

      progress.status = 'completed';
      progress.endTime = new Date();
      const duration = progress.startTime
        ? (progress.endTime.getTime() - progress.startTime.getTime()) / 1000
        : 0;

      this.logger.log(
        `Forest Fire historical collection completed in ${duration}s. Saved: ${progress.savedItems}, Duplicates: ${progress.duplicateSkipped}, Errors: ${progress.errors}`,
      );

      return {
        success: true,
        message: `Successfully collected ${daysToCollect} days of Forest Fire data (API limit: max 10 days)`,
        details: progress,
      };
    } catch (error) {
      progress.status = 'error';
      progress.endTime = new Date();
      progress.errorMessages.push(error.message);

      this.logger.error(`Forest Fire historical collection failed: ${error.message}`);

      return {
        success: false,
        message: `Failed to collect Forest Fire data: ${error.message}`,
        details: progress,
      };
    } finally {
      setTimeout(() => this.progressTracking.delete(taskId), 3600000);
    }
  }

  /**
   * Collect Forest Fire Archive Data (2000-2024)
   * Downloads data in 10-day chunks using date range loops
   * @param startYear Start year (2000 for MODIS, 2012 for VIIRS)
   * @param endYear End year (current year)
   * @param source Satellite source (MODIS_NRT, VIIRS_SNPP_NRT, etc.)
   */
  async collectForestFireArchive(
    startYear: number,
    endYear: number,
    source: string = 'MODIS_NRT',
  ): Promise<CollectionResult> {
    const taskId = `forest-fire-archive-${Date.now()}`;
    
    const progress: CollectionProgress = {
      status: 'running',
      module: `Forest Fire Archive (${startYear}-${endYear})`,
      startTime: new Date(),
      totalItems: 0,
      processedItems: 0,
      savedItems: 0,
      duplicateSkipped: 0,
      errors: 0,
      errorMessages: [],
      progressPercent: 0,
    };

    this.progressTracking.set(taskId, progress);
    this.logger.log(`Starting Forest Fire Archive collection: ${startYear}-${endYear}, source: ${source}`);

    try {
      // Get estimate
      const estimate = this.firmsArchiveService.estimateFireCount(startYear, endYear);
      this.logger.log(`Estimated: ${estimate.estimatedFires.toLocaleString()} fires, ` +
        `${estimate.estimatedSizeMB}MB, ${estimate.estimatedTimeMinutes} minutes`);

      // Generate date ranges (10-day chunks)
      const dateRanges = this.firmsArchiveService.generateDateRanges(startYear, endYear);
      this.logger.log(`Generated ${dateRanges.length} date ranges to process`);

      let processedRanges = 0;

      for (const range of dateRanges) {
        try {
          this.logger.log(`Processing range ${processedRanges + 1}/${dateRanges.length}: ${range.startDate}`);

          // Download CSV data
          const csvData = await this.firmsArchiveService.downloadArchiveCSV(
            source,
            range.startDate,
            range.days,
          );

          if (!csvData || csvData.trim().length === 0) {
            this.logger.warn(`No data available for ${range.startDate}`);
            processedRanges++;
            continue;
          }

          // Parse CSV to fire objects
          const fires = this.firmsArchiveService.parseCSV(csvData);
          progress.totalItems += fires.length;

          if (fires.length === 0) {
            processedRanges++;
            continue;
          }

          this.logger.log(`Parsed ${fires.length} fires from ${range.startDate}`);

          // Process in batches (1000 records at a time for archive imports)
          const batchSize = 1000;
          for (let i = 0; i < fires.length; i += batchSize) {
            const batch = fires.slice(i, i + batchSize);

            for (const fire of batch) {
              try {
                // Check for duplicate
                const existing = await this.forestFireModel.findOne({
                  latitude: fire.latitude,
                  longitude: fire.longitude,
                  acq_date: fire.acq_date,
                  acq_time: fire.acq_time,
                });

                if (existing) {
                  progress.duplicateSkipped++;
                  progress.processedItems++;
                  continue;
                }

                // Save to database
                await this.forestFireModel.create({
                  latitude: fire.latitude,
                  longitude: fire.longitude,
                  brightness: fire.brightness,
                  scan: fire.scan,
                  track: fire.track,
                  acq_date: fire.acq_date,
                  acq_time: fire.acq_time,
                  satellite: fire.satellite,
                  confidence: fire.confidence,
                  version: fire.version,
                  bright_t31: fire.bright_t31,
                  frp: fire.frp,
                  daynight: fire.daynight,
                  source,
                });

                progress.savedItems++;
                progress.processedItems++;
              } catch (error) {
                progress.errors++;
                this.logger.error(`Error saving fire: ${error.message}`);
              }
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          processedRanges++;
          progress.progressPercent = Math.round((processedRanges / dateRanges.length) * 100);

          this.logger.log(
            `Progress: ${progress.progressPercent}% ` +
            `(${processedRanges}/${dateRanges.length} ranges, ` +
            `${progress.savedItems.toLocaleString()} saved, ` +
            `${progress.duplicateSkipped.toLocaleString()} duplicates)`,
          );

          // Rate limiting: 2 second delay between date ranges to avoid API throttling
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          progress.errors++;
          progress.errorMessages.push(`Range ${range.startDate}: ${error.message}`);
          this.logger.error(`Error processing range ${range.startDate}: ${error.message}`);
          
          // Continue with next range despite errors
          processedRanges++;
        }
      }

      // Mark as completed
      progress.status = 'completed';
      progress.endTime = new Date();
      progress.progressPercent = 100;

      const duration = ((progress.endTime.getTime() - progress.startTime!.getTime()) / 1000 / 60).toFixed(1);
      
      this.logger.log(
        `Archive collection complete! ` +
        `Duration: ${duration} minutes, ` +
        `Total: ${progress.totalItems.toLocaleString()} fires, ` +
        `Saved: ${progress.savedItems.toLocaleString()}, ` +
        `Duplicates: ${progress.duplicateSkipped.toLocaleString()}, ` +
        `Errors: ${progress.errors}`,
      );

      return {
        success: true,
        message: `Successfully collected ${startYear}-${endYear} archive data`,
        details: progress,
      };

    } catch (error) {
      progress.status = 'error';
      progress.endTime = new Date();
      progress.errorMessages.push(error.message);

      this.logger.error(`Archive collection failed: ${error.message}`);

      return {
        success: false,
        message: `Failed to collect archive data: ${error.message}`,
        details: progress,
      };
    } finally {
      setTimeout(() => this.progressTracking.delete(taskId), 3600000);
    }
  }

  /**
   * Bulk import Forest Fire data from uploaded CSV file
   * @param fileBuffer CSV file buffer from upload
   * @param source Satellite source identifier
   */
  async bulkImportForestFires(
    fileBuffer: Buffer,
    source: string = 'MODIS_NRT',
  ): Promise<CollectionResult> {
    const taskId = `forest-fire-bulk-import-${Date.now()}`;
    
    const progress: CollectionProgress = {
      status: 'running',
      module: 'Forest Fire Bulk Import',
      startTime: new Date(),
      totalItems: 0,
      processedItems: 0,
      savedItems: 0,
      duplicateSkipped: 0,
      errors: 0,
      errorMessages: [],
      progressPercent: 0,
    };

    this.progressTracking.set(taskId, progress);
    this.logger.log(`Starting Forest Fire bulk import, source: ${source}`);

    try {
      // Validate CSV format
      const validation = this.firmsArchiveService.validateCSVFormat(fileBuffer);
      
      if (!validation.isValid) {
        throw new Error(`Invalid CSV format: ${validation.error}`);
      }

      this.logger.log(`CSV validation passed. Estimated rows: ${validation.estimatedRows?.toLocaleString()}`);
      
      // Parse CSV in chunks for memory efficiency
      const chunkSize = 5000; // Process 5000 fires at a time
      const chunks = this.firmsArchiveService.parseCSVInChunks(
        fileBuffer.toString('utf-8'),
        chunkSize,
      );

      let chunkNumber = 0;
      const estimatedChunks = Math.ceil((validation.estimatedRows || 0) / chunkSize);

      for (const fires of chunks) {
        chunkNumber++;
        progress.totalItems += fires.length;

        this.logger.log(
          `Processing chunk ${chunkNumber}/${estimatedChunks}: ${fires.length} fires`,
        );

        // Process each fire in the chunk
        for (const fire of fires) {
          try {
            // Check for duplicate
            const existing = await this.forestFireModel.findOne({
              latitude: fire.latitude,
              longitude: fire.longitude,
              acq_date: fire.acq_date,
              acq_time: fire.acq_time,
            });

            if (existing) {
              progress.duplicateSkipped++;
              progress.processedItems++;
              continue;
            }

            // Parse date and time to create timestamp
            const dateStr = fire.acq_date; // Format: YYYY-MM-DD
            const timeStr = fire.acq_time.padStart(4, '0'); // Format: HHMM
            const hour = timeStr.substring(0, 2);
            const minute = timeStr.substring(2, 4);
            const timestamp = new Date(`${dateStr}T${hour}:${minute}:00Z`);

            // Save to database
            await this.forestFireModel.create({
              latitude: fire.latitude,
              longitude: fire.longitude,
              brightness: fire.brightness,
              confidence: typeof fire.confidence === 'number' 
                ? (fire.confidence >= 66 ? 'high' : fire.confidence >= 33 ? 'nominal' : 'low')
                : fire.confidence,
              frp: fire.frp,
              satellite: fire.satellite,
              instrument: fire.instrument || 'MODIS', // Use instrument from CSV or default to MODIS
              acq_date: fire.acq_date,
              acq_time: fire.acq_time,
              daynight: fire.daynight,
              timestamp,
              source,
              coordinates: {
                lat: fire.latitude,
                lon: fire.longitude,
              },
            });

            progress.savedItems++;
            progress.processedItems++;
          } catch (error) {
            progress.errors++;
            if (progress.errors <= 10) {
              progress.errorMessages.push(
                `Fire at ${fire.latitude},${fire.longitude}: ${error.message}`,
              );
            }
          }
        }

        // Update progress
        progress.progressPercent = Math.round((chunkNumber / estimatedChunks) * 100);

        this.logger.log(
          `Progress: ${progress.progressPercent}% ` +
          `(${progress.processedItems.toLocaleString()}/${progress.totalItems.toLocaleString()} processed, ` +
          `${progress.savedItems.toLocaleString()} saved, ` +
          `${progress.duplicateSkipped.toLocaleString()} duplicates)`,
        );

        // Small delay between chunks to avoid overwhelming database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Mark as completed
      progress.status = 'completed';
      progress.endTime = new Date();
      progress.progressPercent = 100;

      const duration = ((progress.endTime.getTime() - progress.startTime!.getTime()) / 1000 / 60).toFixed(1);
      const recordsPerMinute = Math.round(progress.processedItems / parseFloat(duration));
      
      this.logger.log(
        `Bulk import complete! ` +
        `Duration: ${duration} minutes, ` +
        `Speed: ${recordsPerMinute.toLocaleString()} records/min, ` +
        `Total: ${progress.totalItems.toLocaleString()} fires, ` +
        `Saved: ${progress.savedItems.toLocaleString()}, ` +
        `Duplicates: ${progress.duplicateSkipped.toLocaleString()}, ` +
        `Errors: ${progress.errors}`,
      );

      return {
        success: true,
        message: `Successfully imported ${progress.savedItems.toLocaleString()} fire records`,
        details: progress,
      };

    } catch (error) {
      progress.status = 'error';
      progress.endTime = new Date();
      progress.errorMessages.push(error.message);

      this.logger.error(`Bulk import failed: ${error.message}`);

      return {
        success: false,
        message: `Failed to import data: ${error.message}`,
        details: progress,
      };
    } finally {
      setTimeout(() => this.progressTracking.delete(taskId), 3600000);
    }
  }

  /**
   * Get collection progress for all active tasks
   */
  getAllProgress(): CollectionProgress[] {
    return Array.from(this.progressTracking.values());
  }

  /**
   * Get estimated collection times
   */
  getEstimatedTimes() {
    return {
      iceExtent: {
        perYear: '~30-60 seconds',
        fiveYears: '~3-5 minutes',
        tenYears: '~5-10 minutes',
      },
      seaLevel: {
        perMonth: '~20-30 seconds (25 stations)',
        sixMonths: '~2-3 minutes',
        twoYears: '~8-12 minutes',
      },
      temperature: {
        perMonth: '~15-25 seconds (15 cities)',
        sixMonths: '~2-3 minutes',
        oneYear: '~4-6 minutes',
      },
    };
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats() {
    const [iceExtentCount, seaLevelCount, temperatureCount, forestFireCount, airQualityCount] = await Promise.all([
      this.iceExtentModel.countDocuments(),
      this.seaLevelModel.countDocuments(),
      this.temperatureModel.countDocuments(),
      this.forestFireModel.countDocuments(),
      this.airQualityModel.countDocuments(),
    ]);

    // Get date ranges for Ice Extent
    const iceExtentOldest = await this.iceExtentModel.find().sort({ date: 1 }).limit(1).select('date');
    const iceExtentNewest = await this.iceExtentModel.find().sort({ date: -1 }).limit(1).select('date');
    const iceExtentRange = {
      oldest: iceExtentOldest[0]?.date,
      newest: iceExtentNewest[0]?.date,
    };

    // Get date ranges for Sea Level
    const seaLevelOldest = await this.seaLevelModel.find().sort({ timestamp: 1 }).limit(1).select('timestamp');
    const seaLevelNewest = await this.seaLevelModel.find().sort({ timestamp: -1 }).limit(1).select('timestamp');
    const seaLevelRange = {
      oldest: seaLevelOldest[0]?.timestamp,
      newest: seaLevelNewest[0]?.timestamp,
    };

    // Get date ranges for Temperature
    const temperatureOldest = await this.temperatureModel.find().sort({ timestamp: 1 }).limit(1).select('timestamp');
    const temperatureNewest = await this.temperatureModel.find().sort({ timestamp: -1 }).limit(1).select('timestamp');
    const temperatureRange = {
      oldest: temperatureOldest[0]?.timestamp,
      newest: temperatureNewest[0]?.timestamp,
    };

    // Get date ranges for Forest Fire
    const forestFireOldest = await this.forestFireModel.find().sort({ timestamp: 1 }).limit(1).select('timestamp');
    const forestFireNewest = await this.forestFireModel.find().sort({ timestamp: -1 }).limit(1).select('timestamp');
    const forestFireRange = {
      oldest: forestFireOldest[0]?.timestamp,
      newest: forestFireNewest[0]?.timestamp,
    };

    // Get date ranges for Air Quality
    const airQualityOldest = await this.airQualityModel.find().sort({ timestamp: 1 }).limit(1).select('timestamp');
    const airQualityNewest = await this.airQualityModel.find().sort({ timestamp: -1 }).limit(1).select('timestamp');
    const airQualityRange = {
      oldest: airQualityOldest[0]?.timestamp,
      newest: airQualityNewest[0]?.timestamp,
    };

    return {
      iceExtent: {
        totalRecords: iceExtentCount,
        dateRange: iceExtentRange,
        estimatedYears:
          iceExtentRange.oldest && iceExtentRange.newest
            ? (
                (new Date(iceExtentRange.newest).getTime() - new Date(iceExtentRange.oldest).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
              ).toFixed(1)
            : 0,
      },
      seaLevel: {
        totalRecords: seaLevelCount,
        dateRange: seaLevelRange,
        estimatedMonths:
          seaLevelRange.oldest && seaLevelRange.newest
            ? (
                (new Date(seaLevelRange.newest).getTime() - new Date(seaLevelRange.oldest).getTime()) /
                (30 * 24 * 60 * 60 * 1000)
              ).toFixed(1)
            : 0,
      },
      temperature: {
        totalRecords: temperatureCount,
        dateRange: temperatureRange,
        estimatedMonths:
          temperatureRange.oldest && temperatureRange.newest
            ? (
                (new Date(temperatureRange.newest).getTime() - new Date(temperatureRange.oldest).getTime()) /
                (30 * 24 * 60 * 60 * 1000)
              ).toFixed(1)
            : 0,
      },
      forestFire: {
        totalRecords: forestFireCount,
        dateRange: forestFireRange,
        estimatedDays:
          forestFireRange.oldest && forestFireRange.newest
            ? (
                (new Date(forestFireRange.newest).getTime() - new Date(forestFireRange.oldest).getTime()) /
                (24 * 60 * 60 * 1000)
              ).toFixed(1)
            : 0,
      },
      airQuality: {
        totalRecords: airQualityCount,
        dateRange: airQualityRange,
        estimatedDays:
          airQualityRange.oldest && airQualityRange.newest
            ? (
                (new Date(airQualityRange.newest).getTime() - new Date(airQualityRange.oldest).getTime()) /
                (24 * 60 * 60 * 1000)
              ).toFixed(1)
            : 0,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Helper function to sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
