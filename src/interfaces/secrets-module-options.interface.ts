import {ConfigModuleOptions} from '@nestjs/config';
import {SecretsLoaderOptions} from './secrets-loader-options.interface';

export interface SecretsModuleOptions extends ConfigModuleOptions, SecretsLoaderOptions {
}
