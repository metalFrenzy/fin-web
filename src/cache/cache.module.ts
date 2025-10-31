import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';

@Global() 
@Module({
    imports: [
        NestCacheModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                store: redisStore,
                host: configService.get('REDIS_HOST'),
                port: configService.get('REDIS_PORT'),
                ttl: configService.get('REDIS_TTL') || 300,
            }),
            inject: [ConfigService],
            isGlobal: true,
        }),
    ],
    exports: [NestCacheModule],
})
export class CacheModule { }