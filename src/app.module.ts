import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth';
import { DocumentsModule } from './documents/documents.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './typeorm/entities/User.entity';
import { Document } from './typeorm/entities/Document.entity';
import { Account } from './typeorm/entities/Account.entity';
import { Session } from './typeorm/entities/Session.entity';
import { Verification } from './typeorm/entities/Verification.entity';
import { TopicsModule } from './topics/topics.module';
import { Topic } from './typeorm/entities/Topic.entity';
import { MessagesModule } from './messages/messages.module';
import { Message } from './typeorm/entities/Message.entity';
import { AnnotationsModule } from './annotations/annotations.module';
import { Annotation } from './typeorm/entities/Annotation.entity';
import { FoldersModule } from './folders/folders.module';
import { Folder } from './typeorm/entities/Folder.entity';
import { RagModule } from './rag/rag.module';
import { Subscription } from './typeorm/entities/Subscription.entity';
import { Plan } from './typeorm/entities/Plan.entity';
import { Payment } from './typeorm/entities/Payment.entity';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    AuthModule.forRoot(auth),
    DocumentsModule,
    TopicsModule,
    MessagesModule,
    AnnotationsModule,
    FoldersModule,
    RagModule,
    SubscriptionsModule,
    PaymentsModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [
        User,
        Document,
        Account,
        Session,
        Verification,
        Topic,
        Message,
        Annotation,
        Folder,
        Subscription,
        Plan,
        Payment,
      ],
      synchronize: true,
      timezone: 'Z',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
