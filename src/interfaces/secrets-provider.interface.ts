/**
 * Interface for secret providers
 */
export abstract class SecretsProvider {
    /**
     * Checks if a string is a valid secret reference for this provider
     * @param value The string to check
     * @returns True if the string is a valid secret reference
     */
    abstract isSecretReference(value: string): boolean;

    /**
     * Resolves a secret reference to its actual value.
     * @param secretRef The reference to the secret
     * @returns The resolved secret value (string or array of strings)
     * @throws Error when the secret cannot be retrieved or has an invalid format
     */
    abstract resolveSecret(secretRef: string): Promise<string | string[]>;
}

/**
 * The secret providers included with this library.
 *
 * Note: You can also use a custom provider by passing an instance of your provider class to the SecretsLoaderService.
 * Open a PR or reach out to us at support@floracodex.com if you implement your own provider. We'd love to officially
 * support it if it makes sense to add it to this list.
 */
export type SecretsProviderType =
    'AwsParameterStoreProvider' |
    'AwsSecretsManagerProvider' |
    'AzureKeyVaultProvider' |
    'GoogleSecretManagerProvider';
