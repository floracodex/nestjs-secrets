import {Injectable, Logger} from '@nestjs/common';
import {GetParameterCommand, GetParametersByPathCommand, Parameter, SSMClient} from '@aws-sdk/client-ssm';
import {SecretsProvider} from '../interfaces/secrets-provider.interface';

@Injectable()
export class AwsParameterStoreProvider implements SecretsProvider {
    private readonly logger = new Logger(AwsParameterStoreProvider.name);

    /**
     * Regular expression to validate AWS Parameter Store paths.
     * Matches either:
     * - Path format: /path/to/parameter
     * - ARN format: arn:aws:ssm:region:account:parameter/path/to/parameter
     */
    private readonly parameterPathPattern = /^(?:\/[a-zA-Z0-9_./-]+|arn:[a-z-]+:ssm:[a-z0-9-]+:\d{12}:parameter\/[a-zA-Z0-9_./-]+)$/;

    constructor(private readonly client: SSMClient) {
    }

    /**
     * Checks if a string is a valid Parameter Store reference.
     * @param value The string to check
     * @returns True if the string is a valid Parameter Store reference
     */
    isSecretReference(value: string): boolean {
        return this.parameterPathPattern.test(value);
    }

    /**
     * Resolves a Parameter Store reference to its actual value
     * @param secretRef The reference to the secret in AWS Parameter Store
     * @returns The resolved secret value as a string
     * @throws Error when the secret cannot be retrieved or has an invalid format
     */
    async resolveSecret(secretRef: string): Promise<string | string[]> {
        if (secretRef.endsWith('/*')) {
            return await this.retrieveParametersByPath(secretRef);
        }

        return await this.retrieveSingleParameter(secretRef);
    }

    /**
     * Retrieves all parameters under a specific path.
     * @param pathRef The parameter path reference ending with '/*'
     * @returns Array of parameter values
     */
    private async retrieveParametersByPath(pathRef: string): Promise<string[]> {
        const basePath = pathRef.slice(0, -2);

        const command = new GetParametersByPathCommand({
            Path: basePath,
            WithDecryption: true,
            Recursive: true
        });

        const response = await this.client.send(command);

        if (!response.Parameters || response.Parameters.length === 0) {
            throw new Error(`No parameters found at path: ${basePath}`);
        }

        return response.Parameters.map((param: Parameter) => {
            if (!param.Value) {
                this.logger.warn(`Parameter ${param.Name} has no value`);
                return '';
            }
            return param.Value;
        }).filter(Boolean);
    }

    /**
     * Retrieves a single parameter by name.
     * @param paramName The parameter name or ARN
     * @returns The parameter value
     */
    private async retrieveSingleParameter(paramName: string): Promise<string> {
        const command = new GetParameterCommand({
            Name: paramName,
            WithDecryption: true
        });

        const response = await this.client.send(command);

        if (!response.Parameter) {
            throw new Error(`Parameter not found: ${paramName}`);
        }

        if (!response.Parameter.Value) {
            throw new Error(`Parameter value is empty for: ${paramName}`);
        }

        return response.Parameter.Value;
    }
}
