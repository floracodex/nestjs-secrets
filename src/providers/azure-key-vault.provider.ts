import {Injectable, Logger} from '@nestjs/common';
import {SecretClient} from '@azure/keyvault-secrets';
import {SecretsProvider} from '../interfaces/secrets-provider.interface';

@Injectable()
export class AzureKeyVaultProvider implements SecretsProvider {
    private readonly logger = new Logger(AzureKeyVaultProvider.name);

    /**
     * Regular expression to validate Azure Vault paths.
     * - Standard format: https://<vault-name>.vault.azure.net/secrets/<secret-name>
     * - With versions: https://<vault-name>.vault.azure.net/secrets/<secret-name>/<version>
     * - With paths in secret names: https://<vault-name>.vault.azure.net/secrets/<path>/<secret-name>
     */
    private readonly secretUrlPattern = /^https:\/\/[\w-]+\.vault\.azure\.net\/secrets\/([^/\s]+)(?:\/([^/\s]+))?$/;

    constructor(private readonly client: SecretClient) {
    }

    /**
     * Checks if the provided string is a valid Azure Key Vault secret reference.
     * @param value The string to check
     * @returns True if the string is a valid Azure Key Vault secret reference
     */
    isSecretReference(value: string): boolean {
        return this.secretUrlPattern.test(value);
    }

    /**
     * Resolves an Azure Key Vault secret reference to its actual value.
     * @param secretRef The reference URL to the secret (https://<vault-name>.vault.azure.net/secrets/<secret-name>[/<version>])
     * @returns The resolved secret value as a string
     * @throws Error when the secret reference is invalid or cannot be retrieved
     */
    async resolveSecret(secretRef: string): Promise<string> {
        const secretName = this.parseSecretReference(secretRef);

        const response = await this.client.getSecret(secretName);

        if (!response || !response.value) {
            throw new Error(`Secret '${secretName}' was retrieved but has an empty value`);
        }

        return response.value;
    }

    /**
     * Parses an Azure Key Vault secret reference and extracts the secret name.
     * @param secretRef The Azure Key Vault secret reference URL
     * @returns The extracted secret name
     * @throws Error when the secret reference format is invalid
     */
    private parseSecretReference(secretRef: string): string {
        const match = secretRef.match(this.secretUrlPattern);

        if (!match) {
            throw new Error(`Invalid Azure Key Vault secret reference: ${secretRef}. Expected format: https://<vault-name>.vault.azure.net/secrets/<secret-name>[/<version>]`);
        }

        // Extract the vault name (match[0]) and secret name (match[1])
        const vaultName = match[0];
        const secretName = match[1];

        this.logger.debug(`Parsed secret reference from vault: ${vaultName}, secret: ${secretName}`);
        return secretName;
    }

}
