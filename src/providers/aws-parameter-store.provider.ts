import {Injectable, Logger} from '@nestjs/common';
import {SecretProvider} from '../interfaces';
import {Parameter, SSM} from '@aws-sdk/client-ssm';

@Injectable()
export class AwsParameterStoreProvider implements SecretProvider {
    private readonly logger = new Logger(AwsParameterStoreProvider.name);
    private readonly parameterPathPattern = /^\/[a-zA-Z0-9_/.~-]+$/;

    constructor(private readonly client: SSM) {
    }

    isSecretReference(value: string): boolean {
        return this.parameterPathPattern.test(value);
    }

    async resolveSecret(secretRef: string): Promise<string | string[]> {
        try {
            // Get the parameter by path with recursion
            if (secretRef.endsWith('/*')) {
                const basePath = secretRef.slice(0, -2);
                const response = await this.client.getParametersByPath({
                    Path: basePath,
                    WithDecryption: true,
                    Recursive: true
                });

                if (!response.Parameters || response.Parameters.length === 0) {
                    throw new Error(`No parameters found at path: ${basePath}`);
                }

                // Return all parameter values as an array
                return response.Parameters.map((param: Parameter) => param.Value!);
            }

            // Get a single parameter
            const response = await this.client.getParameter({
                Name: secretRef,
                WithDecryption: true
            });

            if (!response.Parameter || !response.Parameter.Value) {
                throw new Error('Parameter value is empty');
            }

            return response.Parameter.Value;
        } catch (error) {
            this.logger.error(`Failed to get AWS parameter: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

}
