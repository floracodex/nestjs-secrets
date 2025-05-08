import {Test, TestingModule} from '@nestjs/testing';
import {SecretsManager, GetSecretValueCommandOutput} from '@aws-sdk/client-secrets-manager';
import { AwsSecretsManagerProvider } from '../../src/providers/aws-secrets-manager.provider';

describe('AwsSecretsManagerProvider', () => {
    let provider: AwsSecretsManagerProvider;
    let mockClient: jest.Mocked<SecretsManager>;

    beforeEach(async () => {
        // Create a properly typed mock for AWS Secrets Manager
        mockClient = {
            getSecretValue: jest.fn()
        } as unknown as jest.Mocked<SecretsManager>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: AwsSecretsManagerProvider,
                    useFactory: () => new AwsSecretsManagerProvider(mockClient)
                }
            ]
        }).compile();

        provider = module.get<AwsSecretsManagerProvider>(AwsSecretsManagerProvider);
    });

    it('should be defined', () => {
        expect(provider).toBeDefined();
    });

    describe('isSecretReference', () => {
        it('should identify valid AWS Secrets Manager ARNs', () => {
            // Test valid ARNs
            expect(provider.isSecretReference('arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret')).toBe(true);
            expect(provider.isSecretReference('arn:aws:secretsmanager:eu-west-1:123456789012:secret:path/to/my-secret')).toBe(true);
            expect(provider.isSecretReference('arn:aws:secretsmanager:us-west-2:123456789012:secret:my-secret-Ab1Cd2')).toBe(true);
        });

        it('should reject invalid references', () => {
            // Test invalid references
            expect(provider.isSecretReference('not-a-secret')).toBe(false);
            expect(provider.isSecretReference('arn:aws:s3:::my-bucket/my-object')).toBe(false);
            expect(provider.isSecretReference('projects/123456/secrets/my-secret')).toBe(false);
            expect(provider.isSecretReference('https://myvault.vault.azure.net/secrets/mysecret')).toBe(false);
        });
    });

    describe('resolveSecret', () => {
        it('should resolve a secret string', async () => {
            const secretRef = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret';

            // In v3, need to provide proper output type
            const mockResponse: GetSecretValueCommandOutput = {
                SecretString: 'my-secret-value',
                $metadata: {}
            };

            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.getSecretValue.mockResolvedValue(mockResponse);

            const result = await provider.resolveSecret(secretRef);

            // Check the correct method was called
            expect(mockClient.getSecretValue).toHaveBeenCalledWith({SecretId: secretRef});
            // Check the result matches expectations
            expect(result).toEqual('my-secret-value');
        });

        it('should resolve a binary secret', async () => {
            const secretRef = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-binary-secret';
            const binaryData = Buffer.from('binary-secret-value');

            // Setup mock response with a binary secret
            const mockResponse: GetSecretValueCommandOutput = {
                SecretBinary: binaryData,
                $metadata: {}
            };

            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.getSecretValue.mockResolvedValue(mockResponse);

            const result = await provider.resolveSecret(secretRef);

            // Check the correct method was called
            expect(mockClient.getSecretValue).toHaveBeenCalledWith({SecretId: secretRef});
            // Check binary data was properly decoded
            expect(result).toEqual('binary-secret-value');
        });

        it('should throw an error if secret is empty', async () => {
            const secretRef = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:empty-secret';

            // Setup mock response with no secret data
            const mockResponse: GetSecretValueCommandOutput = {
                // No SecretString or SecretBinary
                $metadata: {}
            };

            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.getSecretValue.mockResolvedValue(mockResponse);

            // Check that attempting to resolve an empty secret throws an error
            await expect(provider.resolveSecret(secretRef)).rejects.toThrow('Secret value is empty');
        });

        it('should throw an error if secret access fails', async () => {
            const secretRef = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:access-denied';

            // Setup mock error response
            const error = new Error('Access denied to secret');
            // @ts-expect-error: `never` type is inferred, which leads to type mismatch errors.
            mockClient.getSecretValue.mockRejectedValue(error);

            // Check that the error is properly propagated
            await expect(provider.resolveSecret(secretRef)).rejects.toThrow('Access denied to secret');
        });
    });

});
