import {type ConfigModuleOptions} from '@nestjs/config';
import {type SecretsLoaderOptions} from './secrets-loader-options.interface';

export interface SecretsModuleOptions extends ConfigModuleOptions, SecretsLoaderOptions {
}
