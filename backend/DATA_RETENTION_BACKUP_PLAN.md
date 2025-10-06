# Data Retention & Backup Strategy

## 📋 Overview
Implementation plan for automated data cleanup and backup strategy to prevent database bloat and ensure data recovery capabilities.

**Status**: 🔄 IN PROGRESS  
**Priority**: 🔥 CRITICAL  
**Estimated Duration**: 22-32 hours (3-4 days)

---

## 🎯 Objectives

1. **Prevent Database Bloat**: Automatically delete old data based on retention policies
2. **Ensure Data Recovery**: Implement reliable backup and restore procedures
3. **Optimize Performance**: Reduce database size and improve query performance
4. **Compliance**: Meet data retention requirements

---

## 📊 Current State Analysis

### Database Size (Estimated)
```
Air Quality:     ~30 days × 8 cities × 24 records/day = 5,760 records
Temperature:     ~60 days × 25 locations × 1 record/day = 1,500 records
Forest Fires:    ~90 days × variable events = 50,000+ records
Sea Level:       ~180 days × 5 stations × 24 records/day = 21,600 records
Ice Extent:      ~365 days × 2 regions × 1 record/day = 730 records

Total: ~79,590+ records without cleanup
Growth rate: ~500-1000 records/day
```

### Issues Without Retention
- ❌ Database grows indefinitely
- ❌ Query performance degrades over time
- ❌ Storage costs increase
- ❌ No data recovery plan
- ❌ Potential data loss without backups

---

## 🏗️ Implementation Phases

### ✅ **Phase 1: Define Retention Policies** (COMPLETED)
**Duration**: 4-6 hours  
**Status**: ✅ DONE

**Deliverables**:
- ✅ `retention.config.ts` - Retention policy definitions
- ✅ Helper functions for cutoff date calculations
- ✅ Documentation of retention periods

**Retention Policies**:
- Air Quality: **30 days** (high frequency updates)
- Temperature: **60 days** (daily updates)
- Forest Fires: **90 days** (historical analysis)
- Sea Level: **180 days** (long-term monitoring)
- Ice Extent: **365 days** (yearly trends)

---

### 🔄 **Phase 2: Automated Cleanup Jobs** (NEXT)
**Duration**: 6-8 hours  
**Priority**: HIGH

**Tasks**:
1. Create `CleanupService` with scheduled jobs
2. Implement cleanup methods for each data type
3. Add batch deletion logic (1000 records/batch)
4. Log cleanup operations
5. Monitor disk space usage
6. Add cleanup metrics tracking
7. Error handling and retry logic

**Files to Create**:
```
backend/src/modules/environment/services/
  └── cleanup.service.ts           # Main cleanup service
  └── cleanup.service.spec.ts      # Unit tests

backend/src/modules/environment/
  └── cleanup.module.ts            # Module configuration
```

**Cron Schedule**: Daily at 2:00 AM server time

**Cleanup Logic**:
```typescript
async cleanupAirQuality() {
  const cutoffDate = getCutoffDate(RETENTION_POLICIES.airQuality);
  let deletedCount = 0;
  
  while (true) {
    const result = await this.airQualityModel
      .deleteMany({ timestamp: { $lt: cutoffDate } })
      .limit(CLEANUP_BATCH_SIZE);
    
    deletedCount += result.deletedCount;
    if (result.deletedCount < CLEANUP_BATCH_SIZE) break;
  }
  
  this.logger.log(`Cleaned up ${deletedCount} air quality records`);
}
```

---

### ⏳ **Phase 3: MongoDB Backup Strategy** (PENDING)
**Duration**: 8-12 hours  
**Priority**: CRITICAL

#### **Option A: MongoDB Atlas Automated Backups** ⭐ (RECOMMENDED)

**Advantages**:
- ✅ Fully managed, zero maintenance
- ✅ Point-in-time recovery
- ✅ Automatic encryption
- ✅ Cross-region replication

**Configuration**:
1. Enable Continuous Backups in Atlas console
2. Configure retention policy:
   - Hourly snapshots: Keep 24 hours
   - Daily snapshots: Keep 7 days
   - Weekly snapshots: Keep 4 weeks
   - Monthly snapshots: Keep 12 months
3. Test restore procedure in staging environment
4. Document restore steps

**Cost**: ~$5-10/month for Basic plan

#### **Option B: Custom mongodump Script** (Alternative)

**Use Case**: Self-hosted MongoDB or cost optimization

**Tasks**:
1. Create backup script (`scripts/backup-mongodb.sh`)
2. Compress backups (gzip)
3. Upload to cloud storage (AWS S3 / Google Cloud Storage)
4. Schedule via cron (daily at 3 AM)
5. Implement backup rotation (keep 30 days)
6. Create restore script
7. Test restore in staging

**Script Example**:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
DB_NAME="earth-pulse"

# Create backup
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/$DATE"

# Compress
tar -czf "$BACKUP_DIR/$DATE.tar.gz" "$BACKUP_DIR/$DATE"
rm -rf "$BACKUP_DIR/$DATE"

# Upload to S3
aws s3 cp "$BACKUP_DIR/$DATE.tar.gz" "s3://earth-pulse-backups/"

# Delete old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
```

**Cost**: Storage only (~$1-3/month)

---

### ⏳ **Phase 4: Documentation & Testing** (PENDING)
**Duration**: 4-6 hours  
**Priority**: HIGH

**Deliverables**:
1. Backup/Restore runbook
2. Disaster recovery procedures
3. Cleanup monitoring dashboard
4. Test restore in staging environment
5. Update team documentation

**Test Cases**:
- ✅ Restore full database
- ✅ Restore single collection
- ✅ Point-in-time recovery
- ✅ Cleanup runs without errors
- ✅ Cleanup logs are captured
- ✅ Metrics are tracked

---

## 📈 Success Metrics

### Cleanup Service
- ✅ Daily cleanup runs successfully
- ✅ Old data is deleted within retention policy
- ✅ Database size stabilizes
- ✅ No performance impact during cleanup
- ✅ Cleanup logs are monitored

### Backup Strategy
- ✅ Daily backups complete successfully
- ✅ Backups are encrypted
- ✅ Restore time < 30 minutes
- ✅ Point-in-time recovery works
- ✅ Team trained on restore procedures

---

## 🚀 Next Steps

### Immediate (Phase 2):
1. Create `CleanupService`
2. Implement batch deletion logic
3. Add cron scheduling
4. Test in development environment
5. Deploy to staging
6. Monitor for 1 week
7. Deploy to production

### Week 2 (Phase 3):
1. Choose backup strategy (Atlas vs custom)
2. Configure backups
3. Test restore procedure
4. Document process
5. Train team

### Week 3 (Phase 4):
1. Write comprehensive documentation
2. Create monitoring dashboard
3. Setup alerts for backup failures
4. Conduct disaster recovery drill
5. Get sign-off from stakeholders

---

## 💰 Cost Estimation

### Option A: MongoDB Atlas Backups
- Atlas Backup: $5-10/month
- Storage: Included in Atlas plan
- **Total**: $5-10/month

### Option B: Custom Backups
- S3 Storage (50GB): ~$1/month
- Data transfer: ~$0.50/month
- Compute time: Negligible
- **Total**: ~$1.50/month

**Recommendation**: Use Atlas for simplicity and reliability.

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Cleanup deletes active data | High | Add buffer period, test thoroughly |
| Backup fails silently | Critical | Monitor backup status, set up alerts |
| Restore takes too long | Medium | Test restore regularly, optimize process |
| Disk space runs out | High | Monitor disk usage, set up alerts |
| Team doesn't know restore | High | Document thoroughly, conduct training |

---

## 📚 References

- MongoDB Backup Best Practices: https://docs.mongodb.com/manual/core/backups/
- Cron Scheduling: https://docs.nestjs.com/techniques/task-scheduling
- AWS S3 Backup: https://aws.amazon.com/s3/backup/

---

## 📝 Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-10-06 | Phase 1 Complete | Retention policies defined based on data frequency |
| 2025-10-06 | Choose Atlas backups | Recommended for simplicity and reliability |

---

**Last Updated**: October 6, 2025  
**Next Review**: After Phase 2 completion
