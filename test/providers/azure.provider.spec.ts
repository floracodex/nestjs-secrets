import {Test, TestingModule} from '@nestjs/testing';
import {SecretClient} from '@azure/keyvault-secrets';
import { AzureKeyVaultProvider } from '../../src/providers/azure-key-vault.provider';

describe('AzureKeyVaultProvider', () => {
    let provider: AzureKeyVaultProvider;
    let mockClient: jest.Mocked<SecretClient>;

    beforeEach(async () => {
        // Create a properly typed mock for Azure KeyVault SecretClient
        mockClient = {
            getSecret: jest.fn()
        } as unknown as jest.Mocked<SecretClient>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: AzureKeyVaultProvider,
                    useFactory: () => new AzureKeyVaultProvider(mockClient)
                }
            ]
        }).compile();

        provider = module.get<AzureKeyVaultProvider>(AzureKeyVaultProvider);
    });

    it('should be defined', () => {
        expect(provider).toBeDefined();
    });

    describe('isSecretReference', () => {
        it('should identify valid Azure Key Vault URLs', () => {
            // Test valid Azure Key Vault URLs
            expect(provider.isSecretReference('https://my-vault.vault.azure.net/secrets/my-secret')).toBe(true);
            expect(provider.isSecretReference('https://my-vault.vault.azure.net/secrets/my-secret/version123')).toBe(true);
            expect(provider.isSecretReference('https://my-vault-name.vault.azure.net/secrets/db-password')).toBe(true);
        });

        it('should reject invalid references', () => {
            // Test invalid references
            expect(provider.isSecretReference('not-a-secret')).toBe(false);
            expect(provider.isSecretReference('https://example.com/secrets/test')).toBe(false);
            expect(provider.isSecretReference('https://my-vault.vault.azure.net/keys/my-key')).toBe(false);
        });
    });

    describe('resolveSecret', () => {
        it('should extract the secret name from the URL and resolve it', async () => {
            const secretRef = 'https://my-vault.vault.azure.net/secrets/my-secret';

            // Setup mock response - Azure SDK returns a KeyVaultSecret object
            mockClient.getSecret.mockResolvedValue({
                name: 'my-secret',
                value: 'azure-secret-value',
                properties: {
                    vaultUrl: 'https://my-vault.vault.azure.net',
                    version: '1',
                    enabled: true,
                    created: new Date(),
                    updated: new Date()
                    // Other properties as required by the KeyVaultSecret interface
                }
            } as any);

            const result = await provider.resolveSecret(secretRef);

            // Check the secret name was properly extracted
            expect(mockClient.getSecret).toHaveBeenCalledWith('my-secret');
            // Check the result matches expectations
            expect(result).toEqual('azure-secret-value');
        });

        it('should handle secret URLs with version identifiers', async () => {
            const secretRef = 'https://my-vault.vault.azure.net/secrets/my-secret/a1b2c3d4e5f6';

            // Setup mock response
            mockClient.getSecret.mockResolvedValue({
                name: 'my-secret',
                value: 'azure-versioned-secret-value',
                properties: {
                    vaultUrl: 'https://my-vault.vault.azure.net',
                    version: 'a1b2c3d4e5f6',
                    enabled: true,
                    created: new Date(),
                    updated: new Date()
                }
            } as any);

            const result = await provider.resolveSecret(secretRef);

            // Check the secret name was properly extracted (should ignore version)
            expect(mockClient.getSecret).toHaveBeenCalledWith('my-secret');
            // Check the result matches expectations
            expect(result).toEqual('azure-versioned-secret-value');
        });

        it('should handle hyphenated and numeric characters in secret names', async () => {
            // Test with hyphenated and numeric secret name
            const secretRef = 'https://my-vault.vault.azure.net/secrets/my-app123';

            // Setup mock response
            mockClient.getSecret.mockResolvedValue({
                name: 'my-secret',
                value: 'complex-name-secret-value',
                properties: {
                    vaultUrl: 'https://my-vault.vault.azure.net',
                    version: 'a1b2c3d4e5f6',
                    enabled: true,
                    created: new Date(),
                    updated: new Date()
                }
            } as any);

            const result = await provider.resolveSecret(secretRef);

            // Check the secret name was properly extracted
            expect(mockClient.getSecret).toHaveBeenCalledWith('my-app123');
            // Check the result matches expectations
            expect(result).toEqual('complex-name-secret-value');
        });

        it('should throw an error if the secret URL is invalid', async () => {
            const secretRef = 'invalid-url';

            // Check that attempting to resolve an invalid URL throws an error
            await expect(provider.resolveSecret(secretRef)).rejects.toThrow('Invalid Azure Key Vault secret reference');
        });

        it('should throw an error if the secret value is empty', async () => {
            const secretRef = 'https://my-vault.vault.azure.net/secrets/empty-secret';

            // Setup mock response with an empty value
            mockClient.getSecret.mockResolvedValue({
                name: 'my-secret',
                value: '',
                properties: {
                    vaultUrl: 'https://my-vault.vault.azure.net',
                    version: 'a1b2c3d4e5f6',
                    enabled: true,
                    created: new Date(),
                    updated: new Date()
                }
            } as any);

            // Check that attempting to resolve an empty secret throws an error
            await expect(provider.resolveSecret(secretRef)).rejects.toThrow('Secret value is empty');
        });

        it('should throw an error if the secret value is undefined', async () => {
            const secretRef = 'https://my-vault.vault.azure.net/secrets/missing-secret';

            // Setup mock response with no value
            mockClient.getSecret.mockResolvedValue({
                name: 'my-secret',
                value: undefined,
                properties: {
                    vaultUrl: 'https://my-vault.vault.azure.net',
                    version: 'a1b2c3d4e5f6',
                    enabled: true,
                    created: new Date(),
                    updated: new Date()
                }
            } as any);

            // Check that attempting to resolve a missing value throws an error
            await expect(provider.resolveSecret(secretRef)).rejects.toThrow('Secret value is empty');
        });

        it('should throw an error if secret access fails', async () => {
            const secretRef = 'https://my-vault.vault.azure.net/secrets/access-denied-secret';

            // Setup mock error response
            const error = new Error('Access denied to secret');
            mockClient.getSecret.mockRejectedValue(error);

            // Check that the error is properly propagated
            await expect(provider.resolveSecret(secretRef)).rejects.toThrow('Access denied to secret');
        });
    });
});
