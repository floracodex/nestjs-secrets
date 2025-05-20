import { ConsulProvider } from '../../src/providers/consul.provider';
// Import Consul. Jest will automatically use the version from test/__mocks__/consul.ts
// due to the jest.mock('consul') call below.
import Consul from 'consul'; 

// Tell Jest to use the manual mock from the __mocks__ directory.
// This call is hoisted to the top by Jest.
jest.mock('consul');

// Variable to hold the reference to our kv.get mock function.
// It will be retrieved from the mocked Consul module.
let mockKvGet: jest.Mock;

describe('ConsulProvider', () => {
  let provider: ConsulProvider;

  beforeEach(() => {
    // Retrieve the mockKvGet function from the custom property on the mocked Consul constructor.
    // The 'Consul' import here refers to 'test/__mocks__/consul.ts'.
    // We need to cast Consul to 'any' to access the custom property '_mockKvGet'.
    if (typeof (Consul as any)._mockKvGet !== 'function') {
        throw new Error(
            "The mocked Consul module in test/__mocks__/consul.ts " +
            "is not exposing ._mockKvGet correctly. " +
            "Consul imported in test is: " + String(Consul)
        );
    }
    mockKvGet = (Consul as any)._mockKvGet;

    // Clear mock history and implementations before each test.
    // Clear the main mock constructor (Consul) as well.
    // Use 'unknown' cast to satisfy TypeScript for Jest mock properties.
    (Consul as unknown as jest.Mock).mockClear(); 
    mockKvGet.mockClear();
    
    // Re-initialize provider. This will use the mocked Consul constructor.
    provider = new ConsulProvider();
  });

  describe('isSecretReference', () => {
    it('should return true for valid Consul paths', () => {
      expect(provider.isSecretReference('consul:my/secret/key')).toBe(true);
      expect(provider.isSecretReference('consul:another_key')).toBe(true);
      expect(provider.isSecretReference('consul:path/with-hyphen/and_underscore')).toBe(true);
    });

    it('should return false for invalid Consul paths', () => {
      expect(provider.isSecretReference('my/secret/key')).toBe(false); // Missing "consul:" prefix
      expect(provider.isSecretReference('consul:')).toBe(false); // Missing key part
      expect(provider.isSecretReference('consul:my/key#fragment')).toBe(false); // Contains '#', not allowed by pattern
      expect(provider.isSecretReference('vault:my/key')).toBe(false); // Different provider
      expect(provider.isSecretReference('')).toBe(false);
      expect(provider.isSecretReference('consul')).toBe(false); // "consul" alone is not enough
    });
  });

  describe('resolveSecret', () => {
    const secretKey = 'path/to/my/secret';
    const consulReference = `consul:${secretKey}`;
    const rawSecretValue = 'my super secret value';
    const base64SecretValue = Buffer.from(rawSecretValue).toString('base64');

    it('should resolve a secret successfully and decode from base64', async () => {
      mockKvGet.mockResolvedValueOnce({ Value: base64SecretValue });

      const result = await provider.resolveSecret(consulReference);

      expect(result).toBe(rawSecretValue);
      expect(mockKvGet).toHaveBeenCalledWith(secretKey);
      expect(mockKvGet).toHaveBeenCalledTimes(1);
      // Check that the Consul constructor (our mock) was called once.
      expect(Consul).toHaveBeenCalledTimes(1); 
    });

    it('should throw an error if the secret reference format is invalid', async () => {
      const invalidReference = 'invalid:reference';
      await expect(provider.resolveSecret(invalidReference)).rejects.toThrow(
        `Invalid Consul secret reference format: ${invalidReference}`,
      );
      expect(mockKvGet).not.toHaveBeenCalled();
    });

    it('should throw an error if kv.get returns undefined (key not found)', async () => {
      mockKvGet.mockResolvedValueOnce(undefined);

      await expect(provider.resolveSecret(consulReference)).rejects.toThrow(
        `Secret key "${secretKey}" not found in Consul.`,
      );
      expect(mockKvGet).toHaveBeenCalledWith(secretKey);
    });

    it('should throw an error if kv.get returns null (key not found)', async () => {
      mockKvGet.mockResolvedValueOnce(null);

      await expect(provider.resolveSecret(consulReference)).rejects.toThrow(
        `Secret key "${secretKey}" not found in Consul.`,
      );
      expect(mockKvGet).toHaveBeenCalledWith(secretKey);
    });

    it('should throw an error if the response Value property is missing', async () => {
      mockKvGet.mockResolvedValueOnce({ SomeOtherProperty: 'somevalue' }); // Value is missing

      await expect(provider.resolveSecret(consulReference)).rejects.toThrow(
        `No value found for secret key "${secretKey}" in Consul response.`,
      );
      expect(mockKvGet).toHaveBeenCalledWith(secretKey);
    });
    
    it('should throw an error if the response Value property is null', async () => {
      mockKvGet.mockResolvedValueOnce({ Value: null });

      await expect(provider.resolveSecret(consulReference)).rejects.toThrow(
        `No value found for secret key "${secretKey}" in Consul response.`,
      );
      expect(mockKvGet).toHaveBeenCalledWith(secretKey);
    });

    it('should throw an error and log if kv.get itself throws/rejects', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const errorMessage = 'Consul connection error';
      // Mock kv.get to return a Promise that rejects
      mockKvGet.mockRejectedValueOnce(new Error(errorMessage));

      await expect(provider.resolveSecret(consulReference)).rejects.toThrow(
        `Failed to resolve secret from Consul (key: ${secretKey})`,
      );
      expect(mockKvGet).toHaveBeenCalledWith(secretKey);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error resolving secret from Consul (key: ${secretKey}): ${errorMessage}`),
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
