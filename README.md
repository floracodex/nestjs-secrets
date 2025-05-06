# NestJS Secrets: Effortless Cloud Secrets in Your NestJS Configuration

Managing configuration and secrets is a critical aspect of application development. As applications scale and transition across cloud environments, this complexity grows, often leading to custom, non-reusable solutions for integrating with secret management services. NestJS provides a robust configuration library, but bridging it with cloud secret managers typically requires boilerplate code or adopting opinionated external libraries.

`NestJS Secrets` addresses these challenges by offering a streamlined, non-intrusive layer between your NestJS application and popular cloud secret management services. It enhances, rather than replaces, the standard NestJS configuration patterns you're already familiar with.

### The Challenge: Complex Configuration in Modern Applications

Developers building robust NestJS applications often encounter:

* **Manual Secret Integration:** Writing and maintaining custom code to fetch secrets from AWS, Google Cloud, or Azure.
* **Configuration Sprawl:** Difficulty in structuring and managing configuration across different deployment environments (development, staging, production).
* **Security Risks:** The temptation to mix sensitive information with application code or inadvertently commit secrets to source control.
* **Vendor Lock-In:** Solutions tightly coupled to a specific cloud provider's SDK or secret management approach.

These issues can lead to increased development overhead, reduced portability, and potential security vulnerabilities.

### Our Solution: Introducing NestJS Secrets

`NestJS Secrets` simplifies your configuration workflow by:

* **Unifying Access:** Providing a consistent way to retrieve secrets from various cloud providers.
* **Seamless Integration:** Working directly with NestJS's standard `ConfigService` for a familiar developer experience.
* **Declarative Secret Referencing:** Allowing you to reference secrets in your YAML or JSON configuration files without embedding the actual secret values.
* **Automatic Resolution:** Transparently fetching and injecting secret values at application startup.

By handling the complexities of secret retrieval, `NestJS Secrets` lets you focus on your application's core logic while maintaining clean, secure, and environment-agnostic configurations.

### Key Features

* Load configuration from YAML or JSON files.
* Merge multiple configuration files with a defined precedence.
* Resolve secrets from major cloud providers:
    * Google Cloud Secret Manager
    * AWS Parameter Store
    * AWS Secrets Manager
    * Azure Key Vault
* Extensible architecture designed for adding custom secret providers (contributions welcome!).
* Seamless integration with the standard NestJS `ConfigService`.

## Installation

### 1. Basic Installation

First, install the library along with NestJS's core configuration module:

```bash
# Using npm
npm install @floracodex/nestjs-secrets @nestjs/config

# Using yarn
yarn add @floracodex/nestjs-secrets @nestjs/config
```

Note: `@floracodex/nestjs-secrets` builds upon and extends NestJS's own `ConfigModule` (`@nestjs/config`), which is why `@nestjs/config` is a required peer dependency.

#### Requirements

* **Node.js:** `^18.x || ^20.x || ^22.x` (Node.js 18.x or newer is recommended, preferably an active LTS version as of May 2025)
* **NestJS:** Requires NestJS version `^10.0.0` or `^11.0.0`.
* `@nestjs/config`: Requires `@nestjs/config` version `^3.0.0` or `^4.0.0`.

### 2. Install Cloud Provider SDKs (Optional)

Next, install the Software Development Kits (SDKs) for the specific cloud providers you intend to use. These are optional peer dependencies; only install the ones relevant to your project. It's generally recommended to use recent, stable versions of these SDKs.

#### AWS

Install the AWS SDK v3 clients if you plan to use AWS Parameter Store and/or AWS Secrets Manager.

```bash
# For AWS Parameter Store
npm install @aws-sdk/client-ssm
# or using yarn
yarn add @aws-sdk/client-ssm

# For AWS Secrets Manager
npm install @aws-sdk/client-secrets-manager
# or using yarn
yarn add @aws-sdk/client-secrets-manager
````

_You can install one or both, depending on your application's needs._

#### Azure Key Vault

Install the Azure SDKs for Key Vault Secrets. The `@azure/identity` package is also typically required for authentication, but is not included as a peer dependency of this library.

```bash
# Using npm
npm install @azure/keyvault-secrets @azure/identity

# Using yarn
yarn add @azure/keyvault-secrets @azure/identity
```

#### Google Cloud Secret Manager

Install the Google Cloud Secret Manager client library.

```bash
# Using npm
npm install @google-cloud/secret-manager

# Using yarn
yarn add @google-cloud/secret-manager
```

## Basic Usage

This section guides you through the fundamental steps to integrate `NestJS Secrets` into your application, load configuration files (with and without secrets), and access your configuration values.

### 1. Loading Configuration Files

`NestJS Secrets` loads configuration from YAML or JSON files. You can specify multiple files; they will be merged, with values from later files taking precedence over earlier ones. This is useful for environment-specific overrides.

First, create your configuration file(s). For example, a `settings.yaml`:

```yaml
# settings.yaml
application:
    name: My Awesome App
    port: 3000

database:
    host: db.example.com
    port: 5432
    username: db-user
    # This value will be fetched from a secret manager
    password: 'ssm:/my-app/dev/db-password' # Example for AWS Parameter Store

featureFlags:
    newDashboard: true
```

In this example, `ssm:/my-app/dev/db-password` is a reference to a secret. `NestJS Secrets` will automatically resolve this to its actual value if a suitable secret provider is configured. The specific reference format depends on the cloud provider (details in Section 4: Using with Cloud Providers).

You can also have environment-specific files, like `settings.local.yaml`, to override values for local development:

```yaml
# settings.local.yaml
application:
    port: 3001 # Override port for local development

database:
    # Override password for local development, perhaps a non-secret or different reference
    password: 'localdevpassword'
```

### 2. Integrating with `SecretsModule`

Import and configure `SecretsModule` in your root `AppModule`. The `forRoot()` method initializes the configuration system, loading your files and setting up secret resolution if a provider client is supplied.

#### Loading Files Without Secret Resolution:

If you only need to load and merge local configuration files (YAML/JSON) without resolving any external secrets, you can set up the module like this:

```typescript
// app.module.ts
import {Module} from '@nestjs/common';
import {SecretsModule} from '@floracodex/nestjs-secrets';

@Module({
    imports: [
        SecretsModule.forRoot({
            // Optional: specify a subdirectory for your config files
            // root: './config',

            files: ['settings.yaml', 'settings.local.yaml'],

            // Makes ConfigService available globally
            isGlobal: true,

            // Enables caching of configuration values
            cache: true
        })

        // IMPORTANT: Do NOT add ConfigModule.forRoot() here if using SecretsModule.forRoot()
    ]
})
export class AppModule {
}
```

#### Enabling Secret Resolution from Cloud Providers:

To resolve secret references (like `'ssm:/path/to/secret'`) from cloud providers, you need to provide an initialized SDK client for that provider.

* **Auto-detection (Recommended for built-in providers):**

  `NestJS Secrets` can often automatically determine which secret provider to use based on the SDK client you provide.

  Example for Google Cloud Secret Manager:

    ```typescript
    // app.module.ts
    import {Module} from '@nestjs/common';
    import {SecretsModule} from '@floracodex/nestjs-secrets';
    import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
    
    @Module({
        imports: [
            SecretsModule.forRoot({
                files: ['settings.yaml', 'settings.local.yaml'],
                isGlobal: true,
                cache: true,
    
                // Provide the SDK client for Google Cloud Secret Manager
                // The `provider: 'GoogleSecretManagerProvider'` will be inferred
                client: new SecretManagerServiceClient()
            })
  
            // Remeber, do NOT add ConfigModule.forRoot() here
        ]
    })
    export class AppModule {
    }
    ```

* **Explicit Provider Declaration:**

  You can also explicitly declare the provider name. This can be useful for clarity or if there's any ambiguity.

    ```typescript
    // app.module.ts
    import { Module } from '@nestjs/common';
    import { SecretsModule } from '@floracodex/nestjs-secrets';
    import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
    
    @Module({
      imports: [
        SecretsModule.forRoot({
          files: ['settings.yaml', 'settings.local.yaml'],
          isGlobal: true,
          cache: true,
    
          provider: 'GoogleSecretManagerProvider', // Explicitly name the provider
          client: new SecretManagerServiceClient()
        })
      ]
    })
    export class AppModule {}
    ```

#### _Important Note on ConfigModule.forRoot():_

When you use `SecretsModule.forRoot()`, it handles the necessary setup of NestJS's configuration system internally, including applying options like `isGlobal`, `cache`, `ignoreEnvFile`, etc., that you might recognize from `@nestjs/config`. Therefore, you should not also call `ConfigModule.forRoot()` from `@nestjs/config` in the same module imports (e.g., your root `AppModule`). Doing so might lead to conflicts or unexpected behavior with how ConfigService is provided and configured.

If you opt for an advanced setup where you manually use SecretsLoaderService with a factory pattern (covered in the Advanced Usage section), you will then be responsible for setting up `ConfigModule.forRoot()` yourself.

#### Explanation of Core Configuration Options (for SecretsModule.forRoot()):

* `files`: An array of configuration file paths to load (e.g., `['settings.yaml', 'settings.dev.yaml']`). Later files override earlier ones.
* `root` _(optional)_: The base directory for configuration files. Defaults to the project root.
* `isGlobal` _(optional, from `@nestjs/config`)_: If `true`, `ConfigService` is available globally without needing to import `SecretsModule` in other modules.
* `cache` _(optional, from `@nestjs/config`)_: If `true`, resolved configuration (including secrets) is cached for performance.
* `client` _(optional)_: An initialized SDK client instance for your cloud secret manager (e.g., `new SecretManagerServiceClient()` for Google Cloud, `new SSMClient()` for AWS SSM). If provided, and provider is not a custom instance, the library will attempt to use this client to resolve secrets, often auto-detecting the provider type.
* `provider` _(optional)_:
    * Can be a string identifier for a built-in provider (e.g., `'GoogleSecretManagerProvider'`, `'AwsParameterStoreProvider'`). Use with a `client`.
    * Can be an _instance_ of a custom secret provider (see Advanced Usage), in which case `client` is typically omitted.

If neither a `client` (for a built-in provider) nor a custom `provider` instance is supplied, `NestJS Secrets` will still load and merge your configuration files but will not attempt to resolve any secret reference strings. Specific examples for each supported cloud provider are below.

### 3. Accessing Configuration in Your Services

Once `SecretsModule` is configured (and typically made global via `isGlobal: true`), you can inject and use the standard NestJS `ConfigService` to access your configuration values anywhere in your application. Resolved secret values are available just like any other configuration key.

```typescript
// any.service.ts
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class AnyService {
    private dbHost: string;
    private dbPassword_resolved: string; // Will contain the actual password if resolved

    constructor(private configService: ConfigService) {
        // Access simple configuration values
        const appName = this.configService.get<string>('application.name');
        this.dbHost = this.configService.get<string>('database.host');

        // Access a value that was potentially resolved from a secret manager
        this.dbPassword_resolved = this.configService.get<string>('database.password');

        console.log('Application Name:', appName);
        console.log('Database Host:', this.dbHost);
        // console.log('Database Password (Resolved):', this.dbPassword_resolved);
        // Note: Be cautious logging sensitive values, even in development!
    }

    getDatabaseConfig() {
        return {
            host: this.configService.get('database.host'),
            port: this.configService.get<number>('database.port'),
            username: this.configService.get('database.username'),
            password: this.configService.get('database.password') // Already resolved!
        };
    }
}
```

This approach leverages NestJS's built-in dependency injection and configuration handling, allowing `NestJS Secrets` to seamlessly provide resolved secrets without changing how you typically access configuration.

## Using with Cloud Providers

This section provides specific guidance on configuring `NestJS Secrets` to resolve secrets from supported cloud providers. For each provider, you'll find:

* An example of how to configure `SecretsModule.forRoot()`.
* The native secret reference format(s) this library recognizes.

Remember from the previous section that `NestJS Secrets` can often auto-detect the provider from the initialized SDK `client`. You can also explicitly set the `provider` string for clarity. Always ensure the relevant SDK for your chosen provider is installed.

### AWS Parameter Store

AWS Systems Manager Parameter Store provides secure, hierarchical storage for configuration data and secrets management.

#### Module Configuration:

Initialize the `SSMClient` and pass it to `SecretsModule`.

```typescript
// app.module.ts
import {Module} from '@nestjs/common';
import {SecretsModule} from '@floracodex/nestjs-secrets';
import {SSMClient} from '@aws-sdk/client-ssm';

@Module({
    imports: [
        SecretsModule.forRoot({
            files: ['settings.yaml', 'settings.local.yaml'],
            isGlobal: true,
            // Client for AWS Parameter Store (provider auto-detected or use provider: 'AwsParameterStoreProvider')
            client: new SSMClient({
                region: 'us-east-1' // Specify your AWS region
                // Configure credentials as needed
            })
        })
    ]
})
export class AppModule {
}
```

_Note: For robust credential and region management, consult the official [AWS SDK for JavaScript v3 documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/), particularly for the [`SSMClient`](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ssm/)._

#### Recognized Secret Reference Formats:

In your configuration files (e.g., `settings.yaml`), use the native AWS Parameter Store parameter name (path) or its full ARN:

1. **Parameter Name (Path):** Simple path-based names.
    * Example: `/myapplication/dev/database_password`
1. **Parameter ARN:** The full Amazon Resource Name.
    * Example: `arn:aws:ssm:us-east-1:123456789012:parameter/myapplication/dev/api_key`

#### Example `settings.yaml`:

```yaml
database:
    # Using Parameter Name (Path)
    password: '/myapplication/dev/database_password'
api:
    # Using Parameter ARN
    key: 'arn:aws:ssm:us-east-1:123456789012:parameter/myapplication/dev/api_key'
```

### AWS Secrets Manager

AWS Secrets Manager helps you protect secrets needed to access your applications, services, and IT resources.

#### Module Configuration:

Initialize the `SecretsManagerClient` and pass it to `SecretsModule`.

```typescript
// app.module.ts
import {Module} from '@nestjs/common';
import {SecretsModule} from '@floracodex/nestjs-secrets';
import {SecretsManagerClient} from '@aws-sdk/client-secrets-manager';

@Module({
    imports: [
        SecretsModule.forRoot({
            files: ['settings.yaml', 'settings.local.yaml'],
            isGlobal: true,
            // Client for AWS Secrets Manager (provider auto-detected or use provider: 'AwsSecretsManagerProvider')
            client: new SecretsManagerClient({
                region: 'us-west-2' // Specify your AWS region
                // Configure credentials as needed
            })
        })
    ]
})
export class AppModule {
}
```

_Note: For robust credential and region management, consult the official [AWS SDK for JavaScript v3 documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/), particularly for the [`SecretsManagerClient`](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/secrets-manager/) and these [Developer Guide Examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_secrets-manager_code_examples.html)._

> **Development Status:** Initial support for AWS Secrets Manager is based on the AWS SDK documentation. We are actively seeking community feedback and real-world testing to confirm seamless operation. Please share your experiences or help us test!

#### Recognized Secret Reference Format:

In your configuration files, use the full ARN (Amazon Resource Name) of the secret:

* **Secret ARN:**
   * Format: `arn:aws:secretsmanager:<region>:<account-id>:secret:<secret-name>-<random-suffix>`
   * Example: `arn:aws:secretsmanager:us-west-2:123456789012:secret:myapplication/dev/rds_credentials-AbCdEf`

If the secret value is a JSON string, the entire string is returned by default.

#### Example `settings.yaml`:

```yaml
database:
    # Using Secret ARN
    rds_secret_arn: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:myapplication/dev/rds_credentials-AbCdEf'
```

### Google Cloud Secret Manager

Google Cloud Secret Manager allows you to store, manage, and access secrets as binary blobs or text strings.

#### Module Configuration:

Initialize the `SecretManagerServiceClient` and pass it to `SecretsModule`.

```typescript
// app.module.ts
import {Module} from '@nestjs/common';
import {SecretsModule} from '@floracodex/nestjs-secrets';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';

@Module({
    imports: [
        SecretsModule.forRoot({
            files: ['settings.yaml', 'settings.local.yaml'],
            isGlobal: true,
            // Client for Google Cloud Secret Manager (provider auto-detected or use provider: 'GoogleSecretManagerProvider')
            client: new SecretManagerServiceClient({
                // keyFilename: '/path/to/your-service-account-key.json', // Example for local/CI
                // projectId: 'your-gcp-project-id', // Can often be inferred by the environment
            })
        })
    ]
})
export class AppModule {
}
```

_Note: Authentication with Google Cloud services can be environment-dependent. Consult the official [Google Cloud Secret Manager client library documentation for Node.js](https://cloud.google.com/nodejs/docs/reference/secret-manager/latest_) for comprehensive guidance on authentication and project configuration._

#### Recognized Secret Reference Format:

In your configuration files, use the full resource name of the secret version:

* **Secret Version Resource Name:**
   * Format: `projects/<project-id>/secrets/<secret-id>/versions/<version-id_or_alias>`
   * Example: `projects/my-gcp-project/secrets/api_key_prod/versions/latest`
   * Example: `projects/my-gcp-project/secrets/db_password/versions/3`

#### Example settings.yaml:

```yaml
api:
    key: 'projects/my-gcp-project/secrets/api_key_prod/versions/latest'
database:
    password_v3: 'projects/my-gcp-project/secrets/db_password/versions/3'
```

### Azure Key Vault

Azure Key Vault enables you to safeguard cryptographic keys and other secrets used by cloud apps and services.

#### Module Configuration:

Initialize the `SecretClient` using a vault URL and a credential object (e.g., `DefaultAzureCredential` from `@azure/identity`) and pass it to `SecretsModule`.

```typescript
// app.module.ts
import {Module} from '@nestjs/common';
import {SecretsModule} from '@floracodex/nestjs-secrets';
import {SecretClient} from '@azure/keyvault-secrets';
import {DefaultAzureCredential} from '@azure/identity';

@Module({
    imports: [
        SecretsModule.forRoot({
            files: ['settings.yaml', 'settings.local.yaml'],
            isGlobal: true,
            // Client for Azure Key Vault (provider auto-detected or use provider: 'AzureKeyVaultProvider')
            client: new SecretClient(
                `https://your-vault-name.vault.azure.net`, // Replace with your Key Vault URL
                new DefaultAzureCredential()
            )
        })
    ]
})
export class AppModule {
}
```

_Note: `DefaultAzureCredential` is recommended for most scenarios as it attempts multiple authentication methods. Consult the official Azure SDK for JavaScript documentation for details on the [Azure Key Vault Secrets client library](https://learn.microsoft.com/en-us/javascript/api/@azure/keyvault-secrets/) and the [Azure Identity client library](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/)._

> **Development Status:** Initial support for Azure Key Vault is based on the Azure SDK documentation. We are actively seeking community feedback and real-world testing to confirm seamless operation. Please share your experiences or help us test!

#### Recognized Secret Reference Formats:

In your configuration files, use the secret's URI (often referred to as Secret Identifier):

1. **Secret URI (without version):** Fetches the latest version of the secret.
   * Format: `https://<your-vault-name>.vault.azure.net/secrets/<secret-name>`
   * Example: `https://mykeyvaultprod.vault.azure.net/secrets/DatabasePassword`
1. **Secret URI (with version):** Fetches a specific version of the secret.
   * Format: `https://<your-vault-name>.vault.azure.net/secrets/<secret-name>/<secret-version-id>`
   * Example: `https://mykeyvaultprod.vault.azure.net/secrets/ApiKey/0123456789abcdef0123456789abcdef`

#### Example `settings.yaml`:

```yaml
database:
    # Using Secret URI (latest version)
    password: '[https://mykeyvaultprod.vault.azure.net/secrets/DatabasePassword](https://mykeyvaultprod.vault.azure.net/secrets/DatabasePassword)'
service_x:
    # Using Secret URI (specific version)
    api_token: '[https://mykeyvaultprod.vault.azure.net/secrets/ServiceXToken/0123456789abcdef0123456789abcdef](https://mykeyvaultprod.vault.azure.net/secrets/ServiceXToken/0123456789abcdef0123456789abcdef)'
```

### A Note on Native Secret Formats

Instead of using custom prefixes (like `ssm:/` or `gsm:/`), `NestJS Secrets` is designed to directly recognize and process the native reference formats (such as ARNs, resource names, or URIs) of secrets as provided by the cloud services themselves.

When a string value in your configuration files matches one of these recognized native formats for a configured provider, the library will attempt to resolve it by fetching the secret from the respective cloud service using the SDK client you've provided.

Always ensure the string in your YAML/JSON configuration value is the exact, complete native identifier that your cloud provider uses for the secret you wish to retrieve. This approach allows you to use identifiers you're already familiar with from your cloud environment.

## 5. Configuration

This section explains how to organize and manage your configuration files when using `NestJS Secrets`. The library provides flexibility in terms of file formats, directory structures, and handling environment-specific settings.

### File Formats (YAML/JSON)

`NestJS Secrets` supports configuration files written in both YAML** and **JSON** formats.

* **YAML (`.yaml` or `.yml`):** Often preferred for its readability and support for comments.

    ```yaml
    # config/settings.yaml
    application:
        name: My NestJS App
        port: 3000
    database:
        host: localhost
        retries: 3
    ```
  
* **JSON (`.json`):** A widely used format, stricter in syntax.

    ```json5
    // config/settings.json
    {
        "application": {
            "name": "My NestJS App",
            "port": 3000
        },
        "database": {
            "host": "localhost",
            "retries": 3
        }
    }
    ```

The library typically infers the file type from its extension. If you need to use a non-standard extension or explicitly define the type, you can use the `fileType` option in `SecretsModule.forRoot()` (details on module options are typically found in an Advanced Configuration or API Reference section).

You can mix and match file types in the `files` array if needed, as long as each file is correctly formatted.

### Directory Structure and File Paths

You can organize your configuration files however you see fit within your project.

* **`root` Directory:** The `SecretsModule.forRoot({ root: 'path/to/config/dir', ... })` option allows you to specify a base directory from which your configuration files will be loaded. If not specified, it defaults to your project's root directory.
* **`files` Array:** The paths provided in the `files: [...]` array are relative to this `root` directory (or the project root).

#### Common Pattern:
A common practice is to keep all configuration files within a dedicated directory, for example, `/config` at the root of your project:

```
my-nestjs-project/
├── config/
│   ├── common.yaml
│   ├── development.yaml
│   ├── production.yaml
│   └── local.yaml  # For local overrides, often added to .gitignore
├── src/
│   └── app.module.ts
├── package.json
...
```

In your `AppModule`, you would then configure it like this:

```typescript
// app.module.ts
SecretsModule.forRoot({
    root: './config', // Or simply 'config'
    files: ['common.yaml', 'development.yaml', 'local.yaml']
    // ... other options
})
```

### Environment-Specific Configuration
`NestJS Secrets` makes it easy to manage configurations for different environments (e.g., development, staging, production, testing, local). The typical approach is to have:

1. A **base/common** configuration file with default values shared across all environments.
1. **Environment-specific** files that override or add to the base configuration.
1. An optional **local** file (often added to `.gitignore`) for individual developer overrides that should not be committed.

#### Example:

Suppose you have the following files in your `config/` directory:

* `common.yaml`: Shared defaults.
* `production.yaml`: Settings specific to the production environment.
* `local.yaml`: Local developer overrides.

* You would define the loading order in `SecretsModule` like this:

```typescript
// app.module.ts (for a production-like environment)
SecretsModule.forRoot({
    root: './config',
    files: [
        'common.yaml',      // Load base configuration first
        'production.yaml',  // Load production overrides next
        'local.yaml'        // Load local overrides last (if it exists)
    ],
    isGlobal: true
    // ... other options, including cloud provider client if needed
})
```

When the application runs, these files will be loaded and merged according to the rules described below.

### Configuration Merging and Precedence

When multiple configuration files are specified in the `files` array, `NestJS Secrets` loads them in the order they appear. A deep merge strategy is applied to combine their contents:

1. **Order of Precedence:** Files listed later in the `files` array take higher precedence.
1. **Value Overriding:** If the same configuration key exists in multiple files, the value from the last file in the sequence (the one with the highest precedence) will be used.
1. **Deep Merging for Objects:** If the values for a key are objects in multiple files, these objects are deeply merged. This means properties from the higher-precedence object will overwrite properties in the lower-precedence object, and new properties will be added. For non-object values (like strings, numbers, booleans), the value from the highest-precedence file simply replaces the earlier one.
1. **Adding New Keys:** Keys that exist only in later files are added to the final merged configuration.
This merging strategy allows for a clean and powerful way to layer configurations, defining base settings and then selectively overriding or extending them for different environments or local setups.

## Advanced Usage

This section covers more advanced ways to use `NestJS Secrets`, including creating custom secret providers, understanding all module registration options, strategies for testing your application, and manually controlling the configuration loading process.

### Custom Secret Providers

While `NestJS Secrets` provides built-in support for major cloud providers, you can extend its capabilities by creating your own custom secret providers. This is useful if you need to integrate with an unsupported secret manager (like HashiCorp Vault, a local development vault, or a custom internal solution) or if you need specialized logic for resolving certain types of secret references.

To create a custom provider, you need to implement the `SecretProvider` interface:

```typescript
// custom-secret.provider.ts
import {Injectable} from '@nestjs/common';
import {SecretProvider} from '@floracodex/nestjs-secrets'; // Assuming SecretProvider is exported

@Injectable()
export class MyCustomSecretProvider implements SecretProvider {
    /**
     * Checks if a given configuration value string is a reference
     * that this provider should handle.
     * @param value The configuration value to check.
     * @returns True if it's a reference for this provider, false otherwise.
     */
    isSecretReference(value: string): boolean {
        return typeof value === 'string' && value.startsWith('customvault://');
    }

    /**
     * Resolves the secret reference to its actual value.
     * @param secretRef The secret reference string (e.g., "customvault://my-secret-path").
     * @returns A Promise that resolves to the secret value (string or array of strings).
     */
    async resolveSecret(secretRef: string): Promise<string | string[]> {
        const secretPath = secretRef.replace('customvault://', '');

        // Implement your custom logic to fetch the secret here
        // For example, make an API call to your custom vault:
        // const response = await fetch(`https://my-custom-vault.com/api/secrets/${secretPath}`);
        // const secret = await response.text();
        // return secret;

        // Placeholder for demonstration:
        return `resolved-value-for-${secretPath}-from-custom-provider`;
    }
}
```

#### Registering a Custom Provider:

Once your custom provider is created, you register an instance of it with `SecretsModule`:

```typescript
// app.module.ts
import {Module} from '@nestjs/common';
import {SecretsModule} from '@floracodex/nestjs-secrets';
import {MyCustomSecretProvider} from './custom-secret.provider'; // Import your custom provider

@Module({
    imports: [
        SecretsModule.forRoot({
            files: ['settings.yaml'],
            isGlobal: true,
            provider: new MyCustomSecretProvider() // Pass an instance of your custom provider
            // When providing a custom provider instance, the `client` option is typically not used here,
            // as the custom provider itself should handle its own client or connection logic.
        })
    ]
})
export class AppModule {
}
```

In your `settings.yaml`, you could then have:

```yaml
my_api:
    key: 'customvault://path/to/my/apikey'
```

`NestJS Secrets` will use your MyCustomSecretProvider to resolve this reference.

### Manual Configuration with SecretsLoaderService

> **Pro Tip:** This is our preferred way of loading `NestJS Secret`. If all things were right in the world, all dependencies would be injectable and injected where they're needed.

For ultimate control over the configuration loading process or to integrate `NestJS Secrets` into complex existing module factory setups, you can use the `SecretsLoaderService` directly. This approach requires you to set up @nestjs/config's `ConfigModule.forRoot()` yourself and then provide the `ConfigService` using a factory.

This pattern is useful if:

* You need to dynamically configure the `SSMClient` (or any other SDK clients) using NestJS's dependency injection.
* You have other complex asynchronous operations required before configuration is finalized.
* You want to separate the concerns of SDK client provisioning from the secret loading logic.

Here’s an example using AWS Parameter Store, where the `SSMClient` is provided via DI:

```typescript
// app.module.ts
import {Module} from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {SSMClient} from '@aws-sdk/client-ssm'; // AWS SDK Client
import {SecretsLoaderService, SecretsModuleOptions} from '@floracodex/nestjs-secrets'; // Import necessary types

@Module({
    imports: [
        // Configure the base ConfigModule from NestJS.
        // SecretsModule.forRoot() is NOT used in this pattern.
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
            ignoreEnvFile: true
        })
    ],
    providers: [
        // Provide the SSMClient (or any other SDK client)
        {
            provide: SSMClient,
            useFactory: () => {
                return new SSMClient({region: 'us-east-1'}); // Configure your client
            }
        },
        // Override the standard ConfigService with one that uses SecretsLoaderService
        {
            provide: ConfigService,
            useFactory: async (ssmClient: SSMClient) => {
                const secretsLoader = new SecretsLoaderService();
                
                // The load method should return the fully resolved configuration object
                return secretsLoader.load({
                    provider: 'AwsParameterStoreProvider', // Or let it be auto-detected from client
                    client: ssmClient,
                    files: ['settings.yaml', 'settings.local.yaml'],
                    root: './config'
                    // Note that these options _do not_ include the ones available to ConfigModule.
                });
            },
            inject: [SSMClient]
        }
    ]
})
export class AppModule {
}
```

## Conclusion

`NestJS Secrets` aims to streamline a crucial aspect of modern application development: managing configuration and securely integrating secrets, especially when working with cloud environments. It doesn't try to reinvent how you handle configuration in NestJS; instead, it thoughtfully enhances the robust `ConfigModule` you're already familiar with, making the bridge to cloud secret managers nearly transparent.

By reducing the boilerplate and complexity traditionally associated with fetching and integrating secrets, `NestJS Secrets` empowers you to:

* **Focus on your core application logic**, rather than on the intricacies of configuration infrastructure.
* **Maintain cleaner, more secure applications** by keeping sensitive data out of your codebase and configuration files.
* **Adopt a consistent approach** to configuration and secret management, whether you're building a single service or a distributed microservice architecture.
* **Extend the system** with custom providers if your needs go beyond the built-in cloud integrations.

We believe this library offers a practical and developer-friendly solution for a common set of challenges. For a hands-on look at `NestJS Secrets` in action, please check out the example project included in the [library's repository](https://github.com/floracodex/nestjs-secrets).

We hope `NestJS Secrets` simplifies your development workflow and helps you build more secure and robust NestJS applications!

## Contributing

We wholeheartedly welcome contributions, feedback, and suggestions from the community! `NestJS Secrets` is an open-source project, and your input, ideas, and code can help make it even better for everyone. We aim to be approachable, regardless of how extensive this documentation may seem!

### Found a Bug or Have an Idea?

* **Report Bugs:** If you've encountered a bug, please [open an issue](https://github.com/floracodex/nestjs-secrets/issues) on our GitHub repository. Describe the issue in detail, including steps to reproduce it if possible.
* **Suggest Enhancements or Features:** Have an idea for a new feature or an improvement to an existing one? We'd love to hear it! Please [open an issue](https://github.com/floracodex/nestjs-secrets/issues) to share your thoughts.

### Adding New Secret Providers

One of the most impactful ways to contribute is by adding support for more secret management services (e.g., HashiCorp Vault, Doppler, or other solutions). We are very keen to see this library grow in versatility!

* **Working on a New Provider:** _Let Us Know!_ If you're building or thinking about building a new provider, we'd be excited to hear about it. Feel free to [open an issue](https://github.com/floracodex/nestjs-secrets/issues) to share what you're working on. This can be a great way for us to offer support, collaborate, or help align efforts if multiple people are thinking along the same lines. However, this is not a prerequisite for contributing.
* **Share Your Work:** We encourage you to develop and submit a Pull Request for new providers even if you haven't discussed it beforehand. The most important thing is that valuable work and ideas are shared. If your approach is a good fit, we'll be thrilled to merge it. If it needs some adjustments, we can work through that together in the PR. Our main goal is to encourage contributions and prevent useful additions from remaining private.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/floracodex/nestjs-secrets/blob/main/LICENSE) file for details.
