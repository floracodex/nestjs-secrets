import {SecretsLoaderService, type SecretsProvider} from '../../src';
import {AwsSecretsManagerProvider} from '../../src/providers/aws-secrets-manager.provider';
import {AwsParameterStoreProvider} from '../../src/providers/aws-parameter-store.provider';
import {AzureKeyVaultProvider} from '../../src/providers/azure-key-vault.provider';
import {GoogleSecretManagerProvider} from '../../src/providers/google-secret-manager.provider';
import {Test, type TestingModule} from '@nestjs/testing';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {SecretsManager} from '@aws-sdk/client-secrets-manager';
import {SSMClient} from '@aws-sdk/client-ssm';
import {SecretClient} from '@azure/keyvault-secrets';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {DefaultAzureCredential} from '@azure/identity';

jest.mock('../../src/providers/aws-secrets-manager.provider');
jest.mock('../../src/providers/aws-parameter-store.provider');
jest.mock('../../src/providers/azure-key-vault.provider');
jest.mock('../../src/providers/google-secret-manager.provider');

jest.mock('node:fs', () => {
    const originalModule = jest.requireActual('node:fs');
    return {
        ...originalModule,
        existsSync: jest.fn(),
        readFileSync: jest.fn()
    };
});

describe('SecretsLoaderService', () => {
    let configLoader: SecretsLoaderService;

    // Path to our fixtures
    const fixturesDir = path.join(__dirname, '../fixtures');

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [SecretsLoaderService]
        }).compile();

        configLoader = module.get<SecretsLoaderService>(SecretsLoaderService);

        // Reset fs mocks to default behavior when needed
        (fs.existsSync as jest.Mock).mockImplementation((path) =>
            jest.requireActual('fs').existsSync(path)
        );
        (fs.readFileSync as jest.Mock).mockImplementation((path, options) =>
            jest.requireActual('fs').readFileSync(path, options)
        );
    });

    it('should be defined', () => {
        expect(configLoader).toBeDefined();
    });

    describe('load', () => {
        // Basic loading test with actual files
        it('should load and merge actual config files from fixtures', async () => {
            const result = await configLoader.load({
                root: fixturesDir,
                files: ['local.yaml', 'env.yaml']
            });

            expect(result.get('app.name')).toEqual('TestApp');
            expect(result.get('app.port')).toEqual(8080); // Overridden by env.yaml
            expect(result.get('database.host')).toEqual('test-db.example.com'); // From env.yaml
            expect(result.get('database.username')).toEqual('user'); // From default.yaml
        });

        // Test with mock files for more controlled environment
        it('should load and merge config files with mocked fs', async () => {
            // Mock file existence
            (fs.existsSync as jest.Mock).mockImplementation((filepath) => {
                return filepath.includes('config.yaml') || filepath.includes('env.yaml');
            });

            // Mock file content
            (fs.readFileSync as jest.Mock).mockImplementation((filepath) => {
                if (filepath.includes('config.yaml')) {
                    return 'database:\n  host: localhost\napp:\n  port: 3000';
                }
                if (filepath.includes('env.yaml')) {
                    return 'database:\n  host: production.db';
                }
                return '';
            });

            const result = await configLoader.load({
                root: '/fake/path',
                files: ['config.yaml', 'env.yaml']
            });

            // Expect the merged config with env overriding base
            expect(result.get('database.host')).toEqual('production.db');
            expect(result.get('app.port')).toEqual(3000);
        });

        // Test secret resolution
        it('should resolve secrets if provider is available', async () => {
            // Mock file existence and content for a more controlled test
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(
                'api:\n  key: projects/123/secrets/api-key/versions/latest'
            );

            // Mock secret provider
            const mockSecretProvider: SecretsProvider = {
                isSecretReference: jest.fn().mockImplementation(
                    (value) => value === 'projects/123/secrets/api-key/versions/latest'
                ),
                resolveSecret: jest.fn().mockResolvedValue('resolved-secret-value')
            };

            const result = await configLoader.load({
                root: '/fake/path',
                files: ['config.yaml'],
                provider: mockSecretProvider
            });

            // Verify secret was resolved
            expect(mockSecretProvider.isSecretReference).toHaveBeenCalledWith('projects/123/secrets/api-key/versions/latest');
            expect(mockSecretProvider.resolveSecret).toHaveBeenCalledWith('projects/123/secrets/api-key/versions/latest');
            expect(result.get('api.key')).toEqual('resolved-secret-value');
        });

        // Test path resolution
        it('should correctly resolve relative paths', async () => {
            // Spy on the private resolveBaseDirectory method
            // Note: This requires making the method protected or exposing it for testing
            const resolveBaseDirectorySpy = jest.spyOn(
                configLoader as any,
                'resolveBaseDirectory'
            );

            await configLoader.load({
                root: 'config',
                files: ['local.yaml']
            });

            // Check that it tried to resolve 'config' as a simple directory name
            expect(resolveBaseDirectorySpy).toHaveBeenCalledWith('config');

            // We can't easily assert the actual resolved path as it depends on the execution environment
            // but we can check if resolveBaseDirectory was called with the right argument
        });

        // Test missing files
        it('should handle missing files gracefully', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const result = await configLoader.load({
                root: '/fake/path',
                files: ['nonexistent.yaml']
            });

            // Should return an empty config
            expect(result.get('fake')).toBeUndefined();
        });

        // Test JSON files
        it('should load JSON files when specified', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('{ "jsonKey": "jsonValue" }');

            const result = await configLoader.load({
                root: '/fake/path',
                files: ['config.json'],
                fileType: 'json'
            });

            expect(result.get('jsonKey')).toEqual('jsonValue');
        });
    });

    describe('createConfigFactory', () => {
        it('should create a config factory function', async () => {
            // Mock file system
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('test: value');

            const factory = configLoader.createConfigFactory({
                root: '/fake/path',
                files: ['config.yaml']
            });

            expect(typeof factory).toBe('function');

            const config = await factory();
            expect(config).toEqual({test: 'value'});
        });
    });

    // Test deep secret resolution
    it('should resolve secrets in nested objects', async () => {
        // Create a nested config object with secrets
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue(
            'nested:\n  secret: projects/123/secrets/nested-secret\n  deeper:\n    secret: projects/123/secrets/deeper-secret'
        );

        // Mock provider that identifies all secrets
        const mockSecretProvider: SecretsProvider = {
            isSecretReference: jest.fn().mockImplementation(
                (value) => value.includes('projects/')
            ),
            resolveSecret: jest.fn().mockImplementation(
                (secretRef) => Promise.resolve(`resolved-${secretRef.split('/').pop()}`)
            )
        };

        const result = await configLoader.load({
            root: '/fake/path',
            files: ['config.yaml'],
            provider: mockSecretProvider
        });

        // Check both nested secrets were resolved
        expect(result.get('nested.secret')).toEqual('resolved-nested-secret');
        expect(result.get('nested.deeper.secret')).toEqual('resolved-deeper-secret');
    });
});

describe('SecretsLoaderService - createSecretProvider', () => {
    let service: SecretsLoaderService;

    beforeEach(() => {
        service = new SecretsLoaderService();
    });

    it('should return an AwsSecretsManagerProvider instance when the key is "AwsSecretsManagerProvider"', async () => {
        const mockClient = {};
        const provider = await service.createSecretProvider('AwsSecretsManagerProvider', mockClient);

        expect(provider).toBeInstanceOf(AwsSecretsManagerProvider);
        expect(AwsSecretsManagerProvider).toHaveBeenCalledWith(mockClient);
    });

    it('should return an AwsParameterStoreProvider instance when the key is "AwsParameterStoreProvider"', async () => {
        const mockClient = {};
        const provider = await service.createSecretProvider('AwsParameterStoreProvider', mockClient);

        expect(provider).toBeInstanceOf(AwsParameterStoreProvider);
        expect(AwsParameterStoreProvider).toHaveBeenCalledWith(mockClient);
    });

    it('should return an AzureKeyVaultProvider instance when the key is "AzureKeyVaultProvider"', async () => {
        const mockClient = {};
        const provider = await service.createSecretProvider('AzureKeyVaultProvider', mockClient);

        expect(provider).toBeInstanceOf(AzureKeyVaultProvider);
        expect(AzureKeyVaultProvider).toHaveBeenCalledWith(mockClient);
    });

    it('should return a GoogleSecretManagerProvider instance when the key is "GoogleSecretManagerProvider"', async () => {
        const mockClient = {};
        const provider = await service.createSecretProvider('GoogleSecretManagerProvider', mockClient);

        expect(provider).toBeInstanceOf(GoogleSecretManagerProvider);
        expect(GoogleSecretManagerProvider).toHaveBeenCalledWith(mockClient);
    });

    it('should return undefined and log a warning if the provider key is unsupported', async () => {
        const mockClient = {constructor: {name: 'UnsupportedClient'}};

        const logger = (service as any).logger;
        const loggerSpy = jest.spyOn(logger, 'warn');

        const provider = await service.createSecretProvider('UnsupportedProvider', mockClient);

        expect(provider).toBeUndefined();
        expect(loggerSpy).toHaveBeenCalledWith('Unsupported secret provider: UnsupportedClient');
    });
});

describe('SecretsLoaderService - coverage gaps', () => {
    let service: SecretsLoaderService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [SecretsLoaderService]
        }).compile();

        service = module.get<SecretsLoaderService>(SecretsLoaderService);

        (fs.existsSync as jest.Mock).mockReturnValue(false);
        (fs.readFileSync as jest.Mock).mockReturnValue('');
    });

    describe('loadConfigFiles', () => {
        it('should warn and return empty config when files array is empty', async () => {
            const warnSpy = jest.spyOn((service as any).logger, 'warn');

            const result = await service.load({root: '/fake', files: []});

            expect(result.get('anything')).toBeUndefined();
            expect(warnSpy).toHaveBeenCalledWith('No configuration files specified');
        });

        it('should log an error and skip a file with invalid YAML', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(': invalid: yaml: {[unclosed');

            const errorSpy = jest.spyOn((service as any).logger, 'error');

            await service.load({root: '/fake', files: ['bad.yaml']});

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to load config from')
            );
        });

        it('should log an error and skip a file with invalid JSON', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('{invalid json');

            const errorSpy = jest.spyOn((service as any).logger, 'error');

            await service.load({root: '/fake', files: ['bad.json'], fileType: 'json'});

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to load config from')
            );
        });
    });

    describe('loadProvider', () => {
        it('should auto-detect provider type from client constructor name when no provider string is given', async () => {
            const client = new SSMClient({});

            const provider = await service.loadProvider({files: [], client});

            expect(provider).toBeInstanceOf(AwsParameterStoreProvider);
        });
    });

    describe('resolveBaseDirectory', () => {
        it('should log a debug message and use default config directory when root is not specified', async () => {
            const debugSpy = jest.spyOn((service as any).logger, 'debug');

            await service.load({files: ['config.yaml']});

            expect(debugSpy).toHaveBeenCalledWith(
                expect.stringMatching(/No base directory specified, using:.*config/)
            );
        });

        it('should resolve ./-relative paths from the current working directory', async () => {
            const resolveBaseDirectorySpy = jest.spyOn(service as any, 'resolveBaseDirectory');

            await service.load({root: './myconfig', files: ['app.yaml']});

            expect(resolveBaseDirectorySpy.mock.results[0].value).toBe(
                path.resolve(process.cwd(), './myconfig')
            );
        });

        it('should resolve ../-relative paths from the current working directory', async () => {
            const resolveBaseDirectorySpy = jest.spyOn(service as any, 'resolveBaseDirectory');

            await service.load({root: '../myconfig', files: ['app.yaml']});

            expect(resolveBaseDirectorySpy.mock.results[0].value).toBe(
                path.resolve(process.cwd(), '../myconfig')
            );
        });
    });

    describe('resolveSecrets', () => {
        it('should log an error and preserve the original value when the provider throws during resolution', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('db:\n  password: /secrets/db-password');

            const failingProvider: SecretsProvider = {
                isSecretReference: jest.fn().mockReturnValue(true),
                resolveSecret: jest.fn().mockRejectedValue(new Error('Access denied'))
            };
            const errorSpy = jest.spyOn((service as any).logger, 'error');

            const result = await service.load({
                root: '/fake',
                files: ['config.yaml'],
                provider: failingProvider
            });

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to load secret [db.password]: Access denied')
            );
            // Value is preserved as the original reference since resolution failed
            expect(result.get('db.password')).toEqual('/secrets/db-password');
        });
    });
});

describe('SecretsLoaderService - createSecretProviderViaClient', () => {
    let service: SecretsLoaderService;

    beforeEach(() => {
        service = new SecretsLoaderService();
    });

    it('should return an AwsSecretsManagerProvider instance when the key is "SecretManager"', async () => {
        const mockClient = new SecretsManager();
        const provider = await service.createSecretProvider(mockClient.constructor.name, mockClient);

        expect(provider).toBeInstanceOf(AwsSecretsManagerProvider);
        expect(AwsSecretsManagerProvider).toHaveBeenCalledWith(mockClient);
    });

    it('should return an AwsParameterStoreProvider instance when the key is "SSMClient"', async () => {
        const mockClient = new SSMClient({});
        const provider = await service.createSecretProvider(mockClient.constructor.name, mockClient);

        expect(provider).toBeInstanceOf(AwsParameterStoreProvider);
        expect(AwsParameterStoreProvider).toHaveBeenCalledWith(mockClient);
    });

    it('should return an AzureKeyVaultProvider instance when the key is "SecretClient"', async () => {
        const mockClient = new SecretClient('', new DefaultAzureCredential());
        const provider = await service.createSecretProvider(mockClient.constructor.name, mockClient);

        expect(provider).toBeInstanceOf(AzureKeyVaultProvider);
        expect(AzureKeyVaultProvider).toHaveBeenCalledWith(mockClient);
    });

    it('should return a GoogleSecretManagerProvider instance when the key is "SecretManagerServiceClient"', async () => {
        const mockClient = new SecretManagerServiceClient();
        const provider = await service.createSecretProvider(mockClient.constructor.name, mockClient);

        expect(provider).toBeInstanceOf(GoogleSecretManagerProvider);
        expect(GoogleSecretManagerProvider).toHaveBeenCalledWith(mockClient);
    });
});
