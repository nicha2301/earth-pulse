import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SeaLevelDocument = SeaLevel & Document;

@Schema({ timestamps: true })
export class SeaLevel {
  @Prop({ required: true, index: true })
  stationId: string;

  @Prop({ required: true })
  stationName: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
  })
  locationType: string;

  @Prop({
    type: [Number],
    required: true,
    index: '2dsphere',
  })
  coordinates: number[]; // GeoJSON coordinates [longitude, latitude]

  @Prop({ required: true })
  waterLevel: number; // meters relative to datum

  @Prop()
  sigma: number; // standard deviation

  @Prop()
  flags: string; // quality flags from NOAA

  @Prop()
  quality: string; // quality indicator (p=preliminary, v=verified)

  @Prop({ default: 'MLLW' })
  datum: string; // MLLW, MSL, NAVD, etc.

  @Prop({ required: true, index: true })
  timestamp: Date; // measurement time

  @Prop({ default: 'NOAA' })
  source: string;
}

export const SeaLevelSchema = SchemaFactory.createForClass(SeaLevel);

// Create compound indexes for efficient queries
SeaLevelSchema.index({ stationId: 1, timestamp: -1 });
SeaLevelSchema.index({ timestamp: -1 });
SeaLevelSchema.index({ quality: 1, timestamp: -1 });
