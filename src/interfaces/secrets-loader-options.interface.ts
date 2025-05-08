import {SecretsProvider, SecretsProviderType} from './secrets-provider.interface';

export interface SecretsLoaderOptions {
    provider?: SecretsProviderType | SecretsProvider;
    client?: any;

    /**
     * Base directory for config files (absolute or relative). If relative and not specified, defaults to
     * <app_root>/config. If just a directory name is given (e.g. 'config'), it's resolved relative to app root
     */
    root?: string;
    files: string[];
    fileType?: 'yaml' | 'json';
}
