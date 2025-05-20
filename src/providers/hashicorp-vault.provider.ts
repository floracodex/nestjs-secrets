import { SecretsProvider } from '../interfaces/secrets-provider.interface';

import * as Vault from 'node-vault';

export class HashicorpVaultProvider implements SecretsProvider {
  private client: Vault.client;
  private readonly VAULT_SECRET_PATTERN = /^vault:([^#]+)#(.+)$/;

  constructor() {
    this.client = Vault({
      apiVersion: 'v1',
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
    });
  }

  isSecretReference(value: string): boolean {
    return this.VAULT_SECRET_PATTERN.test(value);
  }

  async resolveSecret(secretRef: string): Promise<string | string[]> {
    const match = this.VAULT_SECRET_PATTERN.exec(secretRef);
    if (!match) {
      // As per interface, should throw if it cannot be resolved or has invalid format.
      // An invalid pattern is an invalid format.
      throw new Error(`Invalid Vault secret reference format: ${secretRef}`);
    }

    const [, path, key] = match;

    try {
      const response = await this.client.read(path);
      const secretValue = response.data?.data?.[key];

      if (secretValue === undefined || secretValue === null) {
        throw new Error(`Secret key "${key}" not found in path "${path}"`);
      }

      if (typeof secretValue !== 'string' && !Array.isArray(secretValue)) {
        // Ensure it's a string or string array, though Vault typically stores JSON which can be anything.
        // For this provider, we'll restrict to string or array of strings.
        throw new Error(`Secret value for key "${key}" in path "${path}" is not a string or an array of strings.`);
      }
      // Type assertion is safe here due to the check above
      return secretValue as string | string[];
    } catch (error: any) {
      // Log the original error for debugging, but throw a more generic error to the caller
      console.error(`Error resolving secret from Vault (path: ${path}, key: ${key}): ${error.message}`);
      if (error.message.startsWith('Invalid Vault secret reference format') || error.message.startsWith('Secret key') || error.message.startsWith('Secret value')) {
        throw error; // Re-throw errors we've already formatted
      }
      throw new Error(`Failed to resolve secret from Vault (path: ${path}, key: ${key})`);
    }
  }
}
