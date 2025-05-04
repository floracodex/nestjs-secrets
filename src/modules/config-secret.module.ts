import {DynamicModule, Global, Module} from '@nestjs/common';
import {ConfigModule, ConfigModuleOptions} from '@nestjs/config';
import {SecretProvider} from '../interfaces';
import {ConfigLoader} from '../config-loader';

export interface ConfigSecretsOptions extends ConfigModuleOptions {
    directory?: string;
    files: string[];
    provider?: SecretProvider;
    fileType?: 'yaml' | 'json';
}

@Global()
@Module({})
export class ConfigSecretsCoreModule {
    static forRoot(options: ConfigSecretsOptions): DynamicModule {
        const configLoader = new ConfigLoader();
        const configFactory = configLoader.createConfigFactory({
            directory: options.directory,
            files: options.files,
            provider: options.provider,
            fileType: options.fileType
        });

        const configModuleOptions: ConfigModuleOptions = {
            ...options,
            load: [configFactory],
            // Override any options that we handle ourselves
            ignoreEnvFile: true
        };

        return {
            module: ConfigSecretsCoreModule,
            imports: [ConfigModule.forRoot(configModuleOptions)],
            exports: [ConfigModule]
        };
    }
}
