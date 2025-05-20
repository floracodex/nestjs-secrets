import { SecretsProvider } from '../interfaces/secrets-provider.interface';
import Consul from 'consul';

export class ConsulProvider implements SecretsProvider {
  private client: Consul;
  private readonly CONSUL_SECRET_PATTERN = /^consul:([^#]+)$/;

  constructor(options?: ConstructorParameters<typeof Consul>[0]) {
    // Simplified: Assume 'import Consul from "consul"' directly provides the constructor.
    // This is the most standard expectation. If this fails with 'Consul is not a constructor'
    // or 'consul_1.default is not a constructor', it highlights the interop issue.
    this.client = new Consul(options);
  }

  isSecretReference(value: string): boolean {
    return this.CONSUL_SECRET_PATTERN.test(value);
  }

  async resolveSecret(secretRef: string): Promise<string | string[]> {
    const match = this.CONSUL_SECRET_PATTERN.exec(secretRef);
    if (!match) {
      throw new Error(`Invalid Consul secret reference format: ${secretRef}`);
    }

    const key = match[1];

    try {
      const result: any = await this.client.kv.get(key);

      if (result === undefined || result === null) {
        throw new Error(`Secret key "${key}" not found in Consul.`);
      }
      
      if (result.Value === undefined || result.Value === null) {
          throw new Error(`No value found for secret key "${key}" in Consul response.`);
      }
      
      const decodedValue = Buffer.from(result.Value, 'base64').toString('utf-8');
      return decodedValue;

    } catch (error: any) {
      console.error(`Error resolving secret from Consul (key: ${key}): ${error.message}`);
      if (error.message.startsWith('Invalid Consul secret reference format') || 
          error.message.startsWith(`Secret key "${key}" not found`) || 
          error.message.startsWith(`No value found for secret key "${key}"`)) {
        throw error;
      }
      throw new Error(`Failed to resolve secret from Consul (key: ${key})`);
    }
  }
}
