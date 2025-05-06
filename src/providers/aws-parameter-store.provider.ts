import {Injectable, Logger} from '@nestjs/common';
import {GetParameterCommand, GetParametersByPathCommand, Parameter, SSMClient} from '@aws-sdk/client-ssm';
import {SecretsProvider} from '../interfaces/secrets-provider.interface';

@Injectable()
export class AwsParameterStoreProvider implements SecretsProvider {
    private readonly logger = new Logger(AwsParameterStoreProvider.name);
    private readonly parameterPathPattern = /^(?:\/[a-zA-Z0-9_./-]+|arn:[a-z-]+:ssm:[a-z0-9-]+:\d{12}:parameter\/[a-zA-Z0-9_./-]+)$/;

    constructor(private readonly client: SSMClient) {
    }

    isSecretReference(value: string): boolean {
        return this.parameterPathPattern.test(value);
    }

    async resolveSecret(secretRef: string): Promise<string | string[]> {
        try {
            // Get the parameter by path with recursion
            if (secretRef.endsWith('/*')) {
                const basePath = secretRef.slice(0, -2);

                const command = new GetParametersByPathCommand({
                    Path: basePath,
                    WithDecryption: true,
                    Recursive: true
                });

                const response = await this.client.send(command);

                if (!response.Parameters || response.Parameters.length === 0) {
                    throw new Error(`No parameters found at path: ${basePath}`);
                }

                // Return all parameter values as an array
                return response.Parameters.map((param: Parameter) => param.Value!);
            }

            // Get a single parameter
            const command = new GetParameterCommand({
                Name: secretRef,
                WithDecryption: true
            })
            const response = await this.client.send(command);

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
