import {Injectable, Logger} from '@nestjs/common';
import {SecretsManager} from '@aws-sdk/client-secrets-manager';
import {SecretsProvider} from '../interfaces/secrets-provider.interface';

@Injectable()
export class AwsSecretsManagerProvider implements SecretsProvider {
    private readonly logger = new Logger(AwsSecretsManagerProvider.name);

    /**
     * Regular expression pattern for validating AWS Secrets Manager ARNs
     */
    private readonly arnPattern = /^arn:aws:secretsmanager:[a-z0-9-]+:[0-9]+:secret:.+$/;

    constructor(private readonly client: SecretsManager) {
    }

    /**
     * Checks if a string is a valid AWS Secrets Manager ARN.
     * @param value The string to check
     * @returns True if the string is a valid AWS Secrets Manager ARN
     */
    isSecretReference(value: string): boolean {
        return this.arnPattern.test(value);
    }

    /**
     * Resolves an AWS Secrets Manager ARN to its actual value
     * @param secretRef The AWS Secrets Manager ARN
     * @returns The resolved secret value as a string
     * @throws Error when the secret cannot be retrieved or has an invalid format
     */
    async resolveSecret(secretRef: string): Promise<string> {
        const response = await this.client.getSecretValue({SecretId: secretRef});

        if (response.SecretString) {
            return response.SecretString;
        } else if (response.SecretBinary) {
            return this.decodeBinarySecret(response.SecretBinary);
        }

        throw new Error('Secret value is empty');
    }

    /**
     * Decodes a binary secret to a string.
     * @param binaryData The binary data to decode
     * @returns The decoded string
     */
    private decodeBinarySecret(binaryData: any): string {
        const buff = Buffer.from(binaryData as unknown as string, 'base64');
        return buff.toString('utf8');
    }

}
