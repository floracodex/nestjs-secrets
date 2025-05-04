import {Logger} from '@nestjs/common';
import {ConfigFactory, ConfigService} from '@nestjs/config';
import {existsSync, readFileSync} from 'fs';
import * as yaml from 'js-yaml';
import {isAbsolute, join, resolve} from 'path';
import {isObject, isString, merge} from 'lodash';
import {SecretProvider} from './interfaces';

export interface ConfigLoaderOptions {
    /**
     * Base directory for config files (absolute or relative).
     * If relative and not specified, defaults to <app_root>/config
     * If just a directory name is given (e.g. 'config'), it's resolved relative to app root
     */
    directory?: string;
    files: string[];
    provider?: SecretProvider;
    fileType?: 'yaml' | 'json';
}

/**
 * Configuration loader with support for secret resolution
 */
export class ConfigLoader {
    private readonly logger = new Logger(ConfigLoader.name);

    /**
     * Finds the application root directory
     * (Usually one level up from where this code is running in a typical NestJS app)
     */
    private findAppRootDirectory(): string {
        // Get the directory of the currently executing file
        let currentDir = __dirname;

        // For a compiled app, we may be in dist/, so go up one level
        if (currentDir.endsWith('/dist') || currentDir.endsWith('\\dist')) {
            currentDir = resolve(currentDir, '..');
        }

        // If we're in src/ or lib/, go up one level
        if (currentDir.endsWith('/src') || currentDir.endsWith('\\src') ||
            currentDir.endsWith('/lib') || currentDir.endsWith('\\lib')) {
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
     * Resolves the base directory for configuration files
     */
    private resolveBaseDirectory(baseDir?: string): string {
        const appRoot = this.findAppRootDirectory();

        // If no base directory specified, use <app_root>/config
        if (!baseDir) {
            const configDir = join(appRoot, 'config');
            this.logger.debug(`No base directory specified, using: ${configDir}`);
            return configDir;
        }

        // If it's an absolute path, use it directly
        if (isAbsolute(baseDir)) {
            return baseDir;
        }

        // If it starts with ./ or ../, resolve relative to current working directory
        if (baseDir.startsWith('./') || baseDir.startsWith('../')) {
            return resolve(process.cwd(), baseDir);
        }

        // If it's just a directory name, resolve from app root
        return join(appRoot, baseDir);
    }

    /**
     * Loads configuration and resolves secrets
     * @param options Configuration options
     * @returns ConfigService instance
     */
    public async load(options: ConfigLoaderOptions): Promise<ConfigService> {
        const config = await this.loadConfigFiles(options);
        return new ConfigService(config);
    }

    /**
     * Creates a config factory for use with ConfigModule.forRoot()
     * @param options Configuration options
     * @returns A config factory function
     */
    public createConfigFactory(options: ConfigLoaderOptions): ConfigFactory {
        return async () => {
            return await this.loadConfigFiles(options);
        };
    }

    /**
     * Loads and merges configuration files, resolving secrets if a provider is available
     * @param options Configuration options
     * @returns Merged configuration object
     */
    private async loadConfigFiles(options: ConfigLoaderOptions): Promise<Record<string, any>> {
        const { files, provider, fileType = 'yaml' } = options;

        // Resolve the base directory
        const baseDirectory = this.resolveBaseDirectory(options.directory);

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

    /**
     * Recursively resolves secrets in configuration objects
     */
    private async resolveSecrets(
        config: Record<string, any>,
        path: string = '',
        secretProvider: SecretProvider
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

