import {DynamicModule, Global, Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {SecretsLoaderService} from '../services/secrets-loader.service';
import {SecretsModuleOptions} from '../interfaces/secrets-module-options.interface';

@Global()
@Module({})
export class SecretsModule {
    static async forRoot(options: SecretsModuleOptions): Promise<DynamicModule> {
        const secretsLoaderService = new SecretsLoaderService();
        const configFactory = secretsLoaderService.createConfigFactory(options);

        return {
            module: SecretsModule,
            imports: [
                await ConfigModule.forRoot({
                    ...options,
                    load: [configFactory],
                    // Override any options that we handle ourselves
                    ignoreEnvFile: true
                })
            ],
            exports: [ConfigModule]
        };
    }
}
