import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {SSMClient} from '@aws-sdk/client-ssm';
import {SecretsLoaderService} from '@floracodex/nestjs-secrets';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            cache: true
        })
    ],
    providers: [
        {
            provide: ConfigService,
            useFactory: (client: SSMClient) => {
                const service = new SecretsLoaderService();
                return service.load({
                    provider: 'AwsParameterStoreProvider',
                    client: client,
                    root: './',
                    files: ['settings.yaml', 'settings.local.yaml']
                })
            },
            inject: [
                SSMClient
            ]
        },
        {
            provide: SSMClient,
            useFactory: () => new SSMClient({
                region: 'us-east-1'
            })
        }
    ],
    controllers: [AppController]
})
export class AppModule {
}
