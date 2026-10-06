import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { DocumentsModule } from '../documents/documents.module';
import { UsageController } from './usage.controller';

// Separate module because DocumentsModule already depends on EntitlementsModule.
@Module({
  imports: [EntitlementsModule, DocumentsModule],
  controllers: [UsageController],
})
export class UsageModule {}
