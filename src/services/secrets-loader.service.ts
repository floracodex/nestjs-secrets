import {Injectable, Logger} from '@nestjs/common';
import {ConfigFactory, ConfigService} from '@nestjs/config';
import {existsSync, readFileSync} from 'node:fs';
import * as yaml from 'js-yaml';
import {basename, isAbsolute, join, resolve} from 'node:path';
import {isObject, isString, merge} from 'lodash';
import {SecretsLoaderOptions} from '../interfaces/secrets-loader-options.interface';
import {SecretsProvider} from '../interfaces/secrets-provider.interface';

/**
 * Configuration loader with support for secret resolution
 */
@Injectable()
export class SecretsLoaderService {
    private readonly logger = new Logger(SecretsLoaderService.name);

    /**
     * Creates a config factory for use with ConfigModule.forRoot()
     * @param options Configuration options
     * @returns A config factory function
     */
    public createConfigFactory(options: SecretsLoaderOptions): ConfigFactory {
        return async () => {
            const provider = await this.loadProvider(options);
            return await this.loadConfigFiles(provider, options);
        };
    }

    /**
     * Creates a secrets provider based on the provided key and client.
     * @param key The provider type identifier
     * @param client The client instance to be used by the provider
     * @returns A promise that resolves to the created SecretsProvider or undefined if not supported
     */
    async createSecretProvider(key: string, client: any): Promise<SecretsProvider | undefined> {
        switch (key) {
            case 'AwsSecretsManagerProvider':
            case 'SecretsManager':
                const {AwsSecretsManagerProvider} = await import('../providers/aws-secrets-manager.provider');
                return new AwsSecretsManagerProvider(client);
            case 'AwsParameterStoreProvider':
            case 'SSMClient':
                const {AwsParameterStoreProvider} = await import('../providers/aws-parameter-store.provider');
                return new AwsParameterStoreProvider(client);
            case 'AzureKeyVaultProvider':
            case 'SecretClient':
                const {AzureKeyVaultProvider} = await import('../providers/azure-key-vault.provider');
                return new AzureKeyVaultProvider(client);
            case 'GoogleSecretManagerProvider':
            case 'SecretManagerServiceClient':
                const {GoogleSecretManagerProvider} = await import('../providers/google-secret-manager.provider');
                return new GoogleSecretManagerProvider(client);
        }

        this.logger.warn(`Unsupported secret provider: ${client.constructor.name}`);
        return undefined;
    }

    /**
     * Finds the application root directory
     * (Usually one level up from where this code is running in a typical NestJS app)
     */
    private findAppRootDirectory(): string {
        // Get the directory of the currently executing file
        let currentDir = __dirname;

        const specialDirs = ['dist', 'src', 'lib'];

        // Check if we're in a special directory and move up if needed
        const dirName = basename(currentDir);
        if (specialDirs.includes(dirName)) {
            currentDir = resolve(currentDir, '..');
        }

        // Handle the case where we might be in a deeper directory structure
        const nodeModulesIndex = currentDir.indexOf('node_modules');
        if (nodeModulesIndex > -1) {
            currentDir = currentDir.substring(0, nodeModulesIndex);
        }

        return currentDir;
    }

    /**
     * Determines if the path is specified relative to the current working directory
     */
    private isRelativePathFromCwd(path: string): boolean {
        return path.startsWith('./') || path.startsWith('../');
    }

    /**
     * Loads configuration and resolves secrets
     * @param options Configuration options
     * @returns ConfigService instance
     */
    public async load(options: SecretsLoaderOptions): Promise<ConfigService> {
        const provider = await this.loadProvider(options);
        const config = await this.loadConfigFiles(provider, options);
        return new ConfigService(config);
    }

    /**
     * Loads and merges configuration files, resolving secrets if a provider is available
     * @param provider The instantiated secret provider
     * @param options Configuration options
     * @returns Merged configuration object
     */
    private async loadConfigFiles(provider: SecretsProvider | undefined, options: SecretsLoaderOptions): Promise<Record<string, any>> {
        const {files, fileType = 'yaml'} = options;

        // Resolve the base directory
        const baseDirectory = this.resolveBaseDirectory(options.root);

        if (!files.length) {
            this.logger.warn('No configuration files specified');
            return {};
        }

        let mergedConfig = {};

        for (const filename of files) {
            const filePath = join(baseDirectory, filename);

            if (existsSync(filePath)) {
                try {
                    this.logger.debug(`Loading config from ${filePath}`);
                    const fileContent = readFileSync(filePath, 'utf8');

                    let fileConfig: Record<string, any>;
                    if (fileType === 'yaml' || filename.endsWith('.yml') || filename.endsWith('.yaml')) {
                        fileConfig = yaml.load(fileContent) as Record<string, any>;
                    } else {
                        fileConfig = JSON.parse(fileContent) as Record<string, any>;
                    }

                    // Merge with existing config, with the new config taking precedence
                    // Using lodash's merge function
                    mergedConfig = merge({}, mergedConfig, fileConfig);
                } catch (error) {
                    this.logger.error(`Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
                }
            } else {
                this.logger.debug(`Config file not found: ${filePath}`);
            }
        }

        // Resolve secrets if provider is available
        if (provider) {
            await this.resolveSecrets(mergedConfig, '', provider);
        }

        return mergedConfig;
    }

    public async loadProvider(options: SecretsLoaderOptions): Promise<SecretsProvider | undefined> {
        if (typeof options.provider === 'object') {
            return options.provider;
        }

        if (typeof options.provider === 'string' && options.client) {
            return this.createSecretProvider(options.provider, options.client);
        }

        if (options.client) {
            return this.createSecretProvider(options.client.constructor.name, options.client);
        }

        return undefined;
    }

    /**
     * Resolves the base directory for configuration files based on the provided configuration
     * or defaults to the application's standard config directory
     */
    private resolveBaseDirectory(directoryPath?: string): string {
        const appRoot = this.findAppRootDirectory();

        // If no directory path is specified, use the default config location
        if (!directoryPath) {
            return this.resolveDefaultConfigDirectory(appRoot, 'config');
        }

        // If it's an absolute path, use it directly
        if (isAbsolute(directoryPath)) {
            return directoryPath;
        }

        // Resolve from the current working directory
        if (this.isRelativePathFromCwd(directoryPath)) {
            return resolve(process.cwd(), directoryPath);
        }

        // If it's just a directory name, resolve from app root
        return join(appRoot, directoryPath);
    }

    /**
     * Resolves the default configuration directory path and logs it
     */
    private resolveDefaultConfigDirectory(appRoot: string, configDir: string): string {
        configDir = join(appRoot, configDir);
        this.logger.debug(`No base directory specified, using: ${configDir}`);
        return configDir;
    }

    /**
     * Recursively resolves secrets in configuration objects
     */
    private async resolveSecrets(
        config: Record<string, any>,
        path: string = '',
        secretProvider: SecretsProvider
    ): Promise<void> {
        for (const key in config) {
            const fullPath = path ? `${path}.${key}` : key;

            // Using lodash's isString and isObject
            if (isString(config[key])) {
                if (secretProvider.isSecretReference(config[key])) {
                    try {
                        config[key] = await secretProvider.resolveSecret(config[key]);
                        this.logger.debug(`Loaded secret from provider [${fullPath}]`);
                    } catch (error) {
                        this.logger.error(
                            `Failed to load secret [${fullPath}]: ${error instanceof Error ? error.message : String(error)}`
                        );
                    }
                }
            } else if (isObject(config[key]) && !Array.isArray(config[key])) {
                await this.resolveSecrets(config[key], fullPath, secretProvider);
            }
        }
    }
}

