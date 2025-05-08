import {Test, TestingModule} from '@nestjs/testing';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import { GoogleSecretManagerProvider } from '../../src/providers/google-secret-manager.provider';

describe('GoogleSecretManagerProvider', () => {
    let provider: GoogleSecretManagerProvider;
    let mockClient: jest.Mocked<SecretManagerServiceClient>;

    beforeEach(async () => {
        // Create a properly typed mock for Google Secret Manager
        // Using Partial<> to only implement the methods we need
        mockClient = {
            accessSecretVersion: jest.fn()
        } as unknown as jest.Mocked<SecretManagerServiceClient>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [{
                provide: GoogleSecretManagerProvider,
                useFactory: () => new GoogleSecretManagerProvider(mockClient as SecretManagerServiceClient)
            }]
        }).compile();

        provider = module.get<GoogleSecretManagerProvider>(GoogleSecretManagerProvider);
    });

    it('should be defined', () => {
        expect(provider).toBeDefined();
    });

    describe('isSecretReference', () => {
        it('should identify valid Google Secret Manager references', () => {
            // Test valid references
            expect(provider.isSecretReference('projects/my-project/secrets/my-secret/versions/latest')).toBe(true);
            expect(provider.isSecretReference('projects/123456/secrets/db-password/versions/1')).toBe(true);
            expect(provider.isSecretReference('projects/my-project-id/secrets/api_key/versions/latest')).toBe(true);
        });

        it('should reject invalid references', () => {
            // Test invalid references
            expect(provider.isSecretReference('not-a-secret')).toBe(false);
            expect(provider.isSecretReference('projects/my-project/secrets')).toBe(false); // Incomplete
            expect(provider.isSecretReference('arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret')).toBe(false);
        });
    });

    describe('resolveSecret', () => {
        it('should resolve a secret', async () => {
            const secretRef = 'projects/my-project/secrets/my-secret/versions/latest';

            // Create a properly structured response object that matches Google's API
            const mockResponse = [
                {
                    name: secretRef,
                    payload: {
                        data: 'my-secret-value'
                    }
                },
                null, // metadata (unused in our case)
                null  // request (unused in our case)
            ];

            // Mock the method to return a Promise that resolves to the expected structure
            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.accessSecretVersion.mockResolvedValue(mockResponse);

            const result = await provider.resolveSecret(secretRef);

            // Check the correct method was called
            expect(mockClient.accessSecretVersion).toHaveBeenCalledWith({
                name: secretRef
            });
            // Check the result matches expectations
            expect(result).toEqual('my-secret-value');
        });

        it('should resolve a secret from buffer', async () => {
            const secretRef = 'projects/my-project/secrets/my-secret/versions/latest';

            // Create a properly structured response object that matches Google's API
            const mockResponse = [
                {
                    name: secretRef,
                    payload: {
                        data: Buffer.from('my-secret-value-from-buffer')
                    }
                },
                null, // metadata (unused in our case)
                null  // request (unused in our case)
            ];

            // Mock the method to return a Promise that resolves to the expected structure
            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.accessSecretVersion.mockResolvedValue(mockResponse);

            const result = await provider.resolveSecret(secretRef);

            // Check the correct method was called
            expect(mockClient.accessSecretVersion).toHaveBeenCalledWith({
                name: secretRef
            });
            // Check the result matches expectations
            expect(result).toEqual('my-secret-value-from-buffer');
        });

        it('should throw an error if secret payload is missing', async () => {
            const secretRef = 'projects/my-project/secrets/missing-payload/versions/latest';

            // Mock a response with missing payload
            const mockResponse = [
                {
                    name: secretRef
                    // No payload
                },
                null,
                null
            ];

            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.accessSecretVersion.mockResolvedValue(mockResponse);

            // Check that attempting to resolve a secret with missing payload throws an error
            await expect(provider.resolveSecret(secretRef)).rejects.toThrow('Secret payload is missing');
        });

        it('should throw an error if secret data is missing', async () => {
            const secretRef = 'projects/my-project/secrets/missing-data/versions/latest';

            // Mock a response with payload but missing data
            const mockResponse = [
                {
                    name: secretRef,
                    payload: {
                        // No data field
                    }
                },
                null,
                null
            ];

            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.accessSecretVersion.mockResolvedValue(mockResponse);

            // Check that attempting to resolve a secret with missing data throws an error
            await expect(provider.resolveSecret(secretRef)).rejects.toThrow('Secret payload data is missing');
        });

        it('should handle service errors properly', async () => {
            const secretRef = 'projects/my-project/secrets/error-secret/versions/latest';

            // Mock an error response
            const error = new Error('Secret access denied');
            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.accessSecretVersion.mockRejectedValue(error);

            // Check that the error is properly propagated
            await expect(provider.resolveSecret(secretRef)).rejects.toThrow('Secret access denied');
        });
    });
});

