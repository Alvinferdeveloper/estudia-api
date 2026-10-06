import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Annotation } from '../typeorm/entities/Annotation.entity';
import { AnnotationsController } from './annotations.controller';
import { AnnotationsService } from './annotations.service';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [TypeOrmModule.forFeature([Annotation]), EntitlementsModule],
  controllers: [AnnotationsController],
  providers: [AnnotationsService],
  exports: [AnnotationsService],
})
export class AnnotationsModule {}
