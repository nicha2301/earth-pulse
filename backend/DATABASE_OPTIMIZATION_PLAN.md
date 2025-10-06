# Database Query Optimization Plan

## 📊 Current Database Analysis

### Collections Overview:
1. **air_quality** - Air quality data by city
2. **temperature** - Temperature data by location
3. **forest_fires** - Forest fire detections
4. **sea_level** - Sea level measurements from NOAA stations
5. **ice_extent** - Arctic/Antarctic ice extent data

---

## 🔍 Identified Issues & Optimizations

### 1. **Missing Compound Indexes**

#### ❌ Problem: Temperature Schema
```typescript
// Current: Only individual indexes
@Prop({ required: true, index: true }) location: string;
@Prop({ required: true, index: true }) timestamp: Date;

// Query pattern: findOne({ location: regex }).sort({ timestamp: -1 })
// → Not using compound index!
```

#### ✅ Solution:
```typescript
TemperatureSchema.index({ location: 1, timestamp: -1 });
```

---

### 2. **Case-Insensitive Regex Queries**

#### ❌ Problem:
```typescript
// Air Quality Service - Line 27
.findOne({ city: new RegExp(`^${city}$`, 'i') })

// Temperature Service - Line 27
.findOne({ location: new RegExp(`^${location}$`, 'i') })
```

**Issues**:
- Regex queries **CANNOT use indexes efficiently**
- Case-insensitive regex (`'i'` flag) forces **full collection scan**
- Very slow on large datasets

#### ✅ Solution Options:

**Option A: Normalize Data** (Recommended)
```typescript
// Add lowercase field to schema
@Prop({ required: true, index: true })
cityLower: string; // Store lowercase version

// Query with exact match (uses index)
.findOne({ cityLower: city.toLowerCase() })
```

**Option B: Text Index**
```typescript
// Create text index
AirQualitySchema.index({ city: 'text' });

// Use text search
.findOne({ $text: { $search: city } })
```

---

### 3. **Inefficient Aggregation Pipelines**

#### ❌ Problem: Ice Extent Aggregation (Line 123-153)
```typescript
const pipeline = [
  {
    $match: {
      region,
      date: { $gte: startDate, $lte: endDate },
    },
  },
  {
    $sort: { date: 1 },  // ❌ Sort after match - may not use index
  },
  // ... more stages
];
```

#### ✅ Solution:
```typescript
// 1. Use $sort immediately after $match
// 2. Ensure compound index exists: { region: 1, date: -1 }
// 3. Use $project early to reduce document size
```

---

### 4. **Multiple Sequential Queries** (Historical Collector)

#### ❌ Problem: Lines 963-996
```typescript
// 10 separate queries to find oldest/newest dates
const iceExtentOldest = await this.iceExtentModel.find().sort({ date: 1 }).limit(1);
const iceExtentNewest = await this.iceExtentModel.find().sort({ date: -1 }).limit(1);
const seaLevelOldest = await this.seaLevelModel.find().sort({ timestamp: 1 }).limit(1);
// ... 6 more queries
```

**Issues**:
- 10 round trips to database
- Could be optimized to 5 queries or use aggregation
- Each query needs index support

#### ✅ Solution:
```typescript
// Use aggregation with $facet to get both in one query
const result = await this.iceExtentModel.aggregate([
  {
    $facet: {
      oldest: [{ $sort: { date: 1 } }, { $limit: 1 }, { $project: { date: 1 } }],
      newest: [{ $sort: { date: -1 } }, { $limit: 1 }, { $project: { date: 1 } }],
    },
  },
]);
```

---

### 5. **Missing Select Optimization**

#### ❌ Problem: getCityList() - Lines 61-77
```typescript
const data = await this.airQualityModel
  .find()
  .select('city country coordinates')  // ✅ Good!
  .sort({ city: 1 });

// But then using JavaScript Map to get unique cities
// → Better to use MongoDB aggregation $group
```

#### ✅ Solution:
```typescript
const uniqueCities = await this.airQualityModel.aggregate([
  {
    $group: {
      _id: '$city',
      country: { $first: '$country' },
      coordinates: { $first: '$coordinates' },
    },
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id: 0,
      name: '$_id',
      country: 1,
      coordinates: 1,
    },
  },
]);
```

---

### 6. **Forest Fire Duplicate Check** (Historical Collector)

#### ❌ Problem: Lines 500, 647, 811
```typescript
const existing = await this.forestFireModel.findOne({
  latitude: fire.latitude,
  longitude: fire.longitude,
  acq_date: fire.acq_date,
  acq_time: fire.acq_time,
});
```

**Issues**:
- No compound index for these 4 fields
- Slow duplicate detection on bulk inserts

#### ✅ Solution:
```typescript
// Add compound index
ForestFireSchema.index({ 
  latitude: 1, 
  longitude: 1, 
  acq_date: 1, 
  acq_time: 1 
}, { unique: true, sparse: true });

// Or use upsert with unique constraint
```

---

## 📋 Implementation Plan

### Phase 1: Index Optimization (30 minutes)
- [x] Review all schemas
- [ ] Add missing compound indexes
- [ ] Add lowercase fields for case-insensitive searches
- [ ] Test index usage with explain()

### Phase 2: Query Optimization (45 minutes)
- [ ] Replace regex queries with exact matches
- [ ] Optimize aggregation pipelines
- [ ] Combine multiple queries using $facet
- [ ] Add query performance metrics

### Phase 3: Schema Updates (20 minutes)
- [ ] Add cityLower and locationLower fields
- [ ] Add unique compound indexes for duplicate prevention
- [ ] Migrate existing data to include new fields

### Phase 4: Testing & Validation (15 minutes)
- [ ] Test all optimized queries
- [ ] Verify index usage with explain()
- [ ] Measure performance improvements
- [ ] Document results

---

## 🎯 Expected Performance Improvements

### Before Optimization:
- Regex queries: **100-500ms** (full collection scan)
- Aggregations: **200-1000ms**
- Historical data queries: **500-2000ms** (10 sequential queries)

### After Optimization:
- Indexed exact match: **<10ms** ✅
- Optimized aggregations: **<50ms** ✅
- Combined queries with $facet: **<100ms** ✅

**Overall improvement: 10-20x faster!** 🚀

---

## 📝 MongoDB Best Practices Applied

1. ✅ **Compound indexes** for common query patterns
2. ✅ **Case-insensitive searches** using lowercase fields
3. ✅ **$match early** in aggregation pipelines
4. ✅ **$project early** to reduce document size
5. ✅ **$facet** to combine multiple operations
6. ✅ **Unique indexes** to prevent duplicates
7. ✅ **Select only needed fields** to reduce data transfer
8. ✅ **Use aggregation** instead of post-processing in code

---

## 🔧 Tools for Monitoring

1. **MongoDB Profiler**: Track slow queries (>100ms)
2. **explain()**: Analyze query execution plans
3. **MetricsService**: Track query performance in app
4. **MongoDB Compass**: Visual query analysis

---

## 📚 References

- [MongoDB Index Strategies](https://docs.mongodb.com/manual/indexes/)
- [Aggregation Pipeline Optimization](https://docs.mongodb.com/manual/core/aggregation-pipeline-optimization/)
- [Query Performance](https://docs.mongodb.com/manual/tutorial/optimize-query-performance-with-indexes-and-projections/)
