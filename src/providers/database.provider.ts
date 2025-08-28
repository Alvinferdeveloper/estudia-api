import { dataSource } from '../data-source';

export const databaseProviders = [
    {
        provide: 'DATA_SOURCE',
        useFactory: async () => {
            if (!dataSource.isInitialized) {
                await dataSource.initialize();
            }
            return dataSource;
        },
    },
];