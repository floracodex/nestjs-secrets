import {Injectable, Logger} from '@nestjs/common';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {SecretsProvider} from '../interfaces/secrets-provider.interface';

@Injectable()
export class GoogleSecretManagerProvider implements SecretsProvider {
    private readonly logger = new Logger(GoogleSecretManagerProvider.name);

    /**
     * Regular expression pattern for Google Secret Manager paths
     * Format: projects/{project-id}/secrets/{secret-id}/versions/{version}
     */
    private readonly secretPathPattern = /^projects\/[^/]+\/secrets\/[^/]+\/versions\/[^/]+$/;

    constructor(private readonly client: SecretManagerServiceClient) {
    }

    /**
     * Checks if a string is a valid Google Secret Manager reference.
     * @param value The string to check
     * @returns True if the string is a valid Google Secret Manager reference
     */
    isSecretReference(value: string): boolean {
        return this.secretPathPattern.test(value);
    }

    /**
     * Resolves a Google Secret Manager reference to its actual value.
     * @param secretRef The full path to the secret in format projects/{project}/secrets/{secret}/versions/{version}
     * @returns The resolved secret value as a string
     * @throws Error when the secret cannot be retrieved or has an invalid format
     */
    async resolveSecret(secretRef: string): Promise<string> {
        // The Google client returns an array where the first element contains the response
        const [response] = await this.client.accessSecretVersion({
            name: secretRef
        });

        if (!response || !response.payload) {
            throw new Error('Secret payload is missing');
        }

        if (!response.payload.data) {
            throw new Error('Secret payload data is missing');
        }

        // Return the secret data as a string, handling both Buffer and string formats
        return Buffer.isBuffer(response.payload.data)
            ? response.payload.data.toString('utf8')
            : response.payload.data.toString();
    }
}
