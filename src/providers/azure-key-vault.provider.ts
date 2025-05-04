import {Injectable, Logger} from '@nestjs/common';
import {SecretProvider} from '../interfaces';
import { SecretClient } from '@azure/keyvault-secrets';

// Note: You would typically add @azure/keyvault-secrets as an optional peer dependency
@Injectable()
export class AzureKeyVaultProvider implements SecretProvider {
    private readonly logger = new Logger(AzureKeyVaultProvider.name);
    // Improved regex for Azure Key Vault URLs
    // This pattern matches:
    // - Standard format: https://<vault-name>.vault.azure.net/secrets/<secret-name>
    // - With versions: https://<vault-name>.vault.azure.net/secrets/<secret-name>/<version>
    // - With paths in secret names: https://<vault-name>.vault.azure.net/secrets/<path>/<secret-name>
    private readonly secretUrlPattern = /^https:\/\/[\w-]+\.vault\.azure\.net\/secrets\/([^/\s]+)(?:\/([^/\s]+))?$/;

    constructor(private readonly client: SecretClient) {}

    isSecretReference(value: string): boolean {
        return this.secretUrlPattern.test(value);
    }

    async resolveSecret(secretRef: string): Promise<string> {
        try {
            const match = secretRef.match(this.secretUrlPattern);
            if (!match) {
                throw new Error(`Invalid Azure Key Vault secret reference: ${secretRef}`);
            }

            // Extract the secret name - match[1] contains the path/name component
            const secretName = match[1];

            // Get the secret using the Azure KeyVault client
            const response = await this.client.getSecret(secretName);

            if (!response || !response.value) {
                throw new Error('Secret value is empty');
            }

            return response.value;
        } catch (error) {
            this.logger.error(`Failed to get Azure secret: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}
