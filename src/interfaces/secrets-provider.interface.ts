/**
 * Interface for secret providers
 */
export abstract class SecretsProvider {
    /**
     * Resolves a secret reference to its actual value
     * @param secretRef The reference to the secret
     * @returns The resolved secret value (string or array of strings)
     */
    abstract resolveSecret(secretRef: string): Promise<string | string[]>;

    /**
     * Checks if a string is a valid secret reference for this provider
     * @param value The string to check
     * @returns True if the string is a valid secret reference
     */
    abstract isSecretReference(value: string): boolean;
}

export type SecretsProviderType =
    'AwsParameterStoreProvider' |
    'AwsSecretsManagerProvider' |
    'AzureKeyVaultProvider' |
    'GoogleSecretManagerProvider';
