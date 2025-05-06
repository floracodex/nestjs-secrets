import {Test, TestingModule} from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import {SecretsLoaderService, SecretsProvider} from '../src';

// For mocking fs in some tests
jest.mock('fs', () => {
    const originalModule = jest.requireActual('fs');
    return {
        ...originalModule,
        existsSync: jest.fn(),
        readFileSync: jest.fn()
    };
});

describe('ConfigLoader', () => {
    let configLoader: SecretsLoaderService;

    // Path to our fixtures
    const fixturesDir = path.join(__dirname, 'fixtures');

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [SecretsLoaderService]
        }).compile();

        configLoader = module.get<SecretsLoaderService>(SecretsLoaderService);

        // Reset fs mocks to default behavior when needed
        (fs.existsSync as jest.Mock).mockImplementation(path =>
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
