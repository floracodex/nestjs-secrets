import { HashicorpVaultProvider } from '../../src/providers/hashicorp-vault.provider';
import * as Vault from 'node-vault';

jest.mock('node-vault');

describe('HashicorpVaultProvider', () => {
  let provider: HashicorpVaultProvider;
  let mockVaultClient: jest.Mocked<Vault.client>;

  beforeEach(() => {
    // Reset the mock before each test
    jest.clearAllMocks();
    // Mock the Vault client constructor and its methods
    mockVaultClient = {
      read: jest.fn(),
    } as any;
    (Vault as unknown as jest.Mock).mockReturnValue(mockVaultClient);

    provider = new HashicorpVaultProvider();
  });

  describe('isSecretReference', () => {
    it('should return true for valid Vault paths', () => {
      expect(provider.isSecretReference('vault:secret/data/creds#username')).toBe(true);
      expect(provider.isSecretReference('vault:another/path/to/secret#api_key')).toBe(true);
    });

    it('should return false for invalid Vault paths', () => {
      expect(provider.isSecretReference('secret/data/creds#username')).toBe(false);
      expect(provider.isSecretReference('vault:secret/data/creds')).toBe(false); // Missing key
      expect(provider.isSecretReference('vault:#username')).toBe(false); // Missing path
      expect(provider.isSecretReference('http://example.com')).toBe(false);
      expect(provider.isSecretReference('')).toBe(false);
    });
  });

  describe('resolveSecret', () => {
    const secretPath = 'secret/data/mysql';
    const secretKey = 'password';
    const vaultReference = `vault:${secretPath}#${secretKey}`;
    const secretValue = 'supersecretpassword';

    it('should resolve a secret successfully', async () => {
      mockVaultClient.read.mockResolvedValueOnce({
        data: { data: { [secretKey]: secretValue } },
      } as any);

      const result = await provider.resolveSecret(vaultReference);

      expect(result).toBe(secretValue);
      expect(mockVaultClient.read).toHaveBeenCalledWith(secretPath);
      expect(mockVaultClient.read).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if the secret path is invalid', async () => {
      await expect(provider.resolveSecret('invalid-reference')).rejects.toThrow(
        'Invalid Vault secret reference format: invalid-reference',
      );
      expect(mockVaultClient.read).not.toHaveBeenCalled();
    });

    it('should throw an error if the secret key does not exist in the response', async () => {
      mockVaultClient.read.mockResolvedValueOnce({
        data: { data: { otherKey: 'othervalue' } },
      } as any);

      await expect(provider.resolveSecret(vaultReference)).rejects.toThrow(
        `Secret key "${secretKey}" not found in path "${secretPath}"`,
      );
      expect(mockVaultClient.read).toHaveBeenCalledWith(secretPath);
    });
    
    it('should throw an error if the secret data is not in the expected format (not string/array)', async () => {
      mockVaultClient.read.mockResolvedValueOnce({
        data: { data: { [secretKey]: { complex: 'object' } } },
      } as any);
      await expect(provider.resolveSecret(vaultReference)).rejects.toThrow(
        `Secret value for key "${secretKey}" in path "${secretPath}" is not a string or an array of strings.`,
      );
      expect(mockVaultClient.read).toHaveBeenCalledWith(secretPath);
    });
    
    it('should throw an error if the secret data.data is missing', async () => {
        mockVaultClient.read.mockResolvedValueOnce({
            data: { }, // Missing 'data' field within 'data'
        } as any);
        await expect(provider.resolveSecret(vaultReference)).rejects.toThrow(
            `Secret key "${secretKey}" not found in path "${secretPath}"`,
        );
        expect(mockVaultClient.read).toHaveBeenCalledWith(secretPath);
    });
    
    it('should throw an error if the secret response.data is missing', async () => {
        mockVaultClient.read.mockResolvedValueOnce({} as any); // Missing 'data' field
        await expect(provider.resolveSecret(vaultReference)).rejects.toThrow(
            `Secret key "${secretKey}" not found in path "${secretPath}"`,
        );
        expect(mockVaultClient.read).toHaveBeenCalledWith(secretPath);
    });

    it('should throw an error and log if Vault client throws an error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const errorMessage = 'Vault connection error';
      mockVaultClient.read.mockRejectedValueOnce(new Error(errorMessage));

      await expect(provider.resolveSecret(vaultReference)).rejects.toThrow(
        `Failed to resolve secret from Vault (path: ${secretPath}, key: ${secretKey})`,
      );
      expect(mockVaultClient.read).toHaveBeenCalledWith(secretPath);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error resolving secret from Vault (path: ${secretPath}, key: ${secretKey}): ${errorMessage}`));
      consoleErrorSpy.mockRestore();
    });
  });
});
