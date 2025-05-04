import {DynamicModule, Module} from '@nestjs/common';
import {ConfigSecretsCoreModule, ConfigSecretsOptions} from './config-secret.module';
import {
    AwsParameterStoreProvider,
    AwsSecretsManagerProvider,
    AzureKeyVaultProvider,
    GoogleSecretManagerProvider
} from '../providers';

// Import the client types from their respective packages
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {SecretClient} from '@azure/keyvault-secrets';
import {SecretsManager} from '@aws-sdk/client-secrets-manager';
import {SSM} from '@aws-sdk/client-ssm';

@Module({})
export class ConfigSecretsModule {
    /**
     * Register without a secret provider
     */
    static forRoot(options: ConfigSecretsOptions): DynamicModule {
        return {
            module: ConfigSecretsModule,
            imports: [
                ConfigSecretsCoreModule.forRoot(options)
            ]
        };
    }

    /**
     * Register with Google Secret Manager
     */
    static forGoogleSecretManager(client: SecretManagerServiceClient, options: ConfigSecretsOptions): DynamicModule {
        const provider = new GoogleSecretManagerProvider(client);

        return {
            module: ConfigSecretsModule,
            imports: [
                ConfigSecretsCoreModule.forRoot({
                    ...options,
                    provider: provider
                })
            ]
        };
    }

    /**
     * Register with AWS Secrets Manager
     */
    static forAwsSecretsManager(
        client: SecretsManager,
        options: ConfigSecretsOptions
    ): DynamicModule {
        const provider = new AwsSecretsManagerProvider(client);

        return {
            module: ConfigSecretsModule,
            imports: [
                ConfigSecretsCoreModule.forRoot({
                    ...options,
                    provider: provider
                })
            ]
        };
    }

    /**
     * Register with AWS Parameter Store
     */
    static forAwsParameterStore(client: SSM, options: ConfigSecretsOptions): DynamicModule {
        const provider = new AwsParameterStoreProvider(client);

        return {
            module: ConfigSecretsModule,
            imports: [
                ConfigSecretsCoreModule.forRoot({
                    ...options,
                    provider: provider
                })
            ]
        };
    }

    /**
     * Register with Azure Key Vault
     */
    static forAzureKeyVault(
        client: SecretClient,
        options: ConfigSecretsOptions
    ): DynamicModule {
        const provider = new AzureKeyVaultProvider(client);

        return {
            module: ConfigSecretsModule,
            imports: [
                ConfigSecretsCoreModule.forRoot({
                    ...options,
                    provider: provider
                })
            ]
        };
    }
}
