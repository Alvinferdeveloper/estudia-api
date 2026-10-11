import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

// The driver reads dates as UTC (`timezone: 'Z'`), so the server must run in UTC too: otherwise
// every column MySQL fills (CURRENT_TIMESTAMP) comes back shifted by its offset, and exam deadlines,
// created dates and credit periods all drift.
@Injectable()
export class DatabaseTimezoneCheck implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    const [{ offset }] = await this.dataSource.query<{ offset: number }[]>(
      'SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS offset',
    );
    if (Number(offset) !== 0) {
      throw new Error(
        `MySQL runs ${offset} minutes off UTC, but the app stores dates in UTC. ` +
          `Set default-time-zone='+00:00' in the MySQL server config (my.ini / my.cnf) and restart it.`,
      );
    }
  }
}
