/**
 * Data Retention Configuration
 * Defines how long each data type should be kept in the database
 */

export const RETENTION_POLICIES = {
  // Air Quality - High frequency updates (hourly)
  // Keep 30 days for recent trend analysis
  airQuality: 30,

  // Temperature - Daily updates
  // Keep 60 days for seasonal comparison
  temperature: 60,

  // Forest Fires - Event-based
  // Keep 90 days for historical fire analysis
  forestFire: 90,

  // Sea Level - Long-term monitoring
  // Keep 180 days for tidal patterns and trends
  seaLevel: 180,

  // Ice Extent - Yearly trend analysis
  // Keep 365 days for year-over-year comparison
  iceExtent: 365,
} as const;

/**
 * Batch size for cleanup operations
 * Delete records in batches to avoid memory issues
 */
export const CLEANUP_BATCH_SIZE = 1000;

/**
 * Cleanup schedule (cron expression)
 * Default: Daily at 2:00 AM server time
 */
export const CLEANUP_SCHEDULE = '0 2 * * *';

/**
 * Get retention days for a specific data type
 */
export function getRetentionDays(dataType: keyof typeof RETENTION_POLICIES): number {
  return RETENTION_POLICIES[dataType];
}

/**
 * Get cutoff date for cleanup
 */
export function getCutoffDate(retentionDays: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

/**
 * Human-readable retention policy summary
 */
export function getRetentionSummary(): string {
  return Object.entries(RETENTION_POLICIES)
    .map(([type, days]) => `${type}: ${days} days`)
    .join('\n');
}
