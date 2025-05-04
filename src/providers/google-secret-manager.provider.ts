import { Injectable, Logger } from '@nestjs/common';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { SecretProvider } from '../interfaces';

@Injectable()
export class GoogleSecretManagerProvider implements SecretProvider {
    private readonly logger = new Logger(GoogleSecretManagerProvider.name);
    private readonly secretPathPattern = /^projects\/[^/]+\/secrets\/[^/]+\/versions\/[^/]+$/;

    constructor(private readonly client: SecretManagerServiceClient) {}

    isSecretReference(value: string): boolean {
        return this.secretPathPattern.test(value);
    }

    async resolveSecret(secretRef: string): Promise<string> {
        try {
            // The Google client returns an array where the first element contains the response
            const [response] = await this.client.accessSecretVersion({
                name: secretRef
            });

            if (!response || !response.payload) {
                throw new Error('Secret payload is missing');
            }

            if (!response.payload.data) {
                throw new Error('Secret data is missing');
            }

            // Convert Buffer to string if it's a Buffer, otherwise use it directly
            if (Buffer.isBuffer(response.payload.data)) {
                return response.payload.data.toString('utf8');
            } else {
                return response.payload.data.toString();
            }
        } catch (error) {
            this.logger.error(`Failed to get Google secret: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}
