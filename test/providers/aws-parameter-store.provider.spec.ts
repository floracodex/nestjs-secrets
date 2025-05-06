import {Test, TestingModule} from '@nestjs/testing';
import {GetParameterCommandOutput, GetParametersByPathCommandOutput, SSM} from '@aws-sdk/client-ssm';
import {AwsParameterStoreProvider} from '../../src/providers/aws-parameter-store.provider';

describe('AwsParameterStoreProvider', () => {
    let provider: AwsParameterStoreProvider;
    let mockClient: jest.Mocked<SSM>;

    beforeEach(async () => {
        // Create a properly typed mock for AWS SSM
        mockClient = {
            // getParameter: jest.fn(),
            // getParametersByPath: jest.fn()
            send: jest.fn()
        } as unknown as jest.Mocked<SSM>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: AwsParameterStoreProvider,
                    useFactory: () => new AwsParameterStoreProvider(mockClient)
                }
            ]
        }).compile();

        provider = module.get<AwsParameterStoreProvider>(AwsParameterStoreProvider);
    });

    it('should be defined', () => {
        expect(provider).toBeDefined();
    });

    describe('isSecretReference', () => {
        it('should identify valid AWS Parameter Store paths', () => {
            // Test valid Parameter Store paths
            expect(provider.isSecretReference('/my-app/dev/db/password')).toBe(true);
            expect(provider.isSecretReference('/simple-param')).toBe(true);
            expect(provider.isSecretReference('/my-app/prod/api-key')).toBe(true);
            expect(provider.isSecretReference('arn:aws:ssm:us-east-1:123456789012:parameter/my-secret')).toBe(true);
            expect(provider.isSecretReference('/path/with-special_chars.-')).toBe(true);
        });

        it('should reject invalid references', () => {
            // Test invalid references
            expect(provider.isSecretReference('not-a-parameter')).toBe(false);
            expect(provider.isSecretReference('my-param')).toBe(false); // Missing leading /
            expect(provider.isSecretReference('arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret')).toBe(false);
            expect(provider.isSecretReference('https://my-vault.vault.azure.net/secrets/my-secret')).toBe(false);
            expect(provider.isSecretReference('/param with spaces')).toBe(false); // Spaces not allowed
        });
    });

    describe('resolveSecret', () => {
        it('should resolve a single parameter', async () => {
            const paramRef = '/my-app/dev/db-password';

            // Setup mock response for a single parameter
            const mockResponse: GetParameterCommandOutput = {
                Parameter: {
                    Name: paramRef,
                    Type: 'SecureString',
                    Value: 'db-password-value'
                },
                $metadata: {}
            };

            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.send.mockResolvedValue(mockResponse);

            const result = await provider.resolveSecret(paramRef);

            // Check the correct method was called
            // expect(mockClient.send).toHaveBeenCalledWith(new GetParameterCommand({
            //     Name: paramRef,
            //     WithDecryption: true
            // }));
            // Check the result matches expectations
            expect(result).toEqual('db-password-value');
        });

        it('should resolve multiple parameters when path ends with /*', async () => {
            const paramPathRef = '/my-app/dev/*';

            // Setup mock response for multiple parameters
            const mockResponse: GetParametersByPathCommandOutput = {
                Parameters: [
                    {
                        Name: '/my-app/dev/db-host',
                        Type: 'String',
                        Value: 'db.example.com'
                    },
                    {
                        Name: '/my-app/dev/db-password',
                        Type: 'SecureString',
                        Value: 'secret-password'
                    },
                    {
                        Name: '/my-app/dev/api-key',
                        Type: 'SecureString',
                        Value: 'api-key-value'
                    }
                ],
                $metadata: {}
            };

            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.send.mockResolvedValue(mockResponse);

            const result = await provider.resolveSecret(paramPathRef);

            // Check the correct method was called
            // expect(mockClient.send).toHaveBeenCalledWith(new GetParametersByPathCommand({
            //     Path: '/my-app/dev',
            //     WithDecryption: true,
            //     Recursive: true
            // }));

            // Check the result is an array with all parameter values
            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(['db.example.com', 'secret-password', 'api-key-value']);
        });

        it('should throw an error if no parameters are found at path', async () => {
            const paramPathRef = '/empty-path/*';

            const mockResponse: GetParametersByPathCommandOutput = {
                Parameters: [],
                $metadata: {}
            };

            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.send.mockResolvedValue(mockResponse);

            // Check that attempting to resolve a path with no parameters throws an error
            await expect(provider.resolveSecret(paramPathRef)).rejects.toThrow('No parameters found at path: /empty-path');
        });

        it('should throw an error if parameter is empty', async () => {
            const paramRef = '/empty-param';

            const mockResponse: GetParameterCommandOutput = {
                Parameter: {
                    Name: paramRef,
                    Type: 'SecureString',
                    Value: '' // Empty value
                } as any,
                $metadata: {}
            };

            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.send.mockResolvedValue(mockResponse);

            // Check that attempting to resolve an empty parameter throws an error
            await expect(provider.resolveSecret(paramRef)).rejects.toThrow('Parameter value is empty');
        });

        it('should throw an error if parameter is missing', async () => {
            const paramRef = '/missing-param';

            // Setup mock response with no parameter
            const mockResponse: GetParameterCommandOutput = {
                // No Parameter property
                $metadata: {}
            };

            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.send.mockResolvedValue(mockResponse);

            // Check that attempting to resolve a missing parameter throws an error
            await expect(provider.resolveSecret(paramRef)).rejects.toThrow('Parameter not found: /missing-para');
        });

        it('should throw an error if parameter access fails', async () => {
            const paramRef = '/access-denied-param';

            // Setup mock error response
            const error = new Error('Parameter not found');
            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.send.mockRejectedValue(error);

            // Check that the error is properly propagated
            await expect(provider.resolveSecret(paramRef)).rejects.toThrow('Parameter not found');
        });
    });
});
