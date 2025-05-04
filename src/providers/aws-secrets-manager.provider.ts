import { Injectable, Logger } from '@nestjs/common';
import { SecretProvider } from '../interfaces';
import {SecretsManager} from '@aws-sdk/client-secrets-manager';

// Note: You would typically add aws-sdk as an optional peer dependency
@Injectable()
export class AwsSecretsManagerProvider implements SecretProvider {
    private readonly logger = new Logger(AwsSecretsManagerProvider.name);
    private readonly arnPattern = /^arn:aws:secretsmanager:[a-z0-9-]+:[0-9]+:secret:.+$/;

    constructor(private readonly client: SecretsManager) {}

    isSecretReference(value: string): boolean {
        return this.arnPattern.test(value);
    }

    async resolveSecret(secretRef: string): Promise<string> {
        try {
            const response = await this.client.getSecretValue({ SecretId: secretRef });

            if (response.SecretString) {
                return response.SecretString;
            } else if (response.SecretBinary) {
                // If binary secret, convert from Buffer to string
                const buff = Buffer.from(response.SecretBinary as unknown as string, 'base64');
                return buff.toString('utf8');
            }

            throw new Error('Secret value is empty');
        } catch (error) {
            this.logger.error(`Failed to get AWS secret: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}
