import { betterAuth } from 'better-auth';
import { typeormAdapter } from '@hedystia/better-auth-typeorm';
import { dataSource } from '../data-source';

export const auth = betterAuth({
    database: typeormAdapter(dataSource),
    basePath: '/api/auth',
    trustedOrigins: ['http://localhost:3000'],
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
    },
});
