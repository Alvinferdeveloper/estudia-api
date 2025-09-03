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

@Module({
  imports: [
    AuthModule.forRoot(auth),
    DocumentsModule,
    TopicsModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [
        User, Document, Account, Session, Verification, Topic
      ],
      synchronize: true,
      timezone: 'Z',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }