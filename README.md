# NestJS Secrets: Effortless Cloud Secrets in Your NestJS Configuration

`NestJS Secrets` simplifies how you manage configuration and securely integrate secrets from cloud providers into your NestJS applications. It enhances NestJS's standard `ConfigModule` without reinventing the wheel, allowing you to keep sensitive data out of your codebase and easily handle environment-specific settings.

**For full documentation, please visit our [GitHub Wiki](https://github.com/floracodex/nestjs-secrets/wiki).**

## Key Features

* Load configuration from YAML or JSON files.
* Merge multiple configuration files with defined precedence.
* Resolve secrets directly from native identifiers of major cloud providers:
    * [AWS Parameter Store](https://github.com/floracodex/nestjs-secrets/wiki/5.1.-Using-with-AWS-Parameter-Store)
    * [AWS Secrets Manager](https://github.com/floracodex/nestjs-secrets/wiki/5.2.-Using-with-AWS-Secrets-Manager)
    * [Azure Key Vault](https://github.com/floracodex/nestjs-secrets/wiki/5.3.-Using-with-Azure-Key-Vault)
    * [Google Cloud Secret Manager](https://github.com/floracodex/nestjs-secrets/wiki/5.4.-Using-with-Google-Cloud-Secret-Manager)
    * **Hashicorp Vault**: Resolves secrets in the format `vault:path/to/secret#key`. Requires `VAULT_ADDR` and `VAULT_TOKEN` environment variables for the `node-vault` client. (Detailed guide on Wiki)
    * **Consul KV**: Resolves secrets in the format `consul:path/to/key`. The `consul` client is configured via environment variables (e.g., `CONSUL_HTTP_ADDR`, `CONSUL_HTTP_TOKEN`) or client options. (Detailed guide on Wiki)
        *   **Note:** The `consul` npm package (version `0.x` or `2.x` as of this writing) used by this provider is deprecated. Users should monitor for alternatives or consider contributing to an updated client library.
* Extensible architecture to support custom secret providers.
* Seamless integration with the standard NestJS `ConfigService`.

## Installation

```bash
npm install @floracodex/nestjs-secrets @nestjs/config node-vault consul
```
*(Note: `node-vault` and `consul` are peer dependencies if you intend to use these specific providers. Install them explicitly in your project.)*

## Requirements

* **Node.js:** `^18.x || ^20.x || ^22.x` (Node.js 18.x or newer is recommended, preferably an active LTS version as of May 2025)
* **NestJS:** Requires NestJS version `^10.0.0` or `^11.0.0`.
* `@nestjs/config`: Requires `@nestjs/config` version `^3.0.0` or `^4.0.0`.

## Quick Start

### 1. Create a configuration file (e.g., `settings.yaml`):

```yaml
# settings.yaml
db:
    host: db.example.com
    # Example: Native ARN for an AWS Parameter Store secret
    password: 'arn:aws:ssm:us-east-1:123456789012:parameter/myapplication/dev/db_password'
    # Example: Hashicorp Vault secret
    api_key: 'vault:secret/data/myapp/config#apiKey'
    # Example: Consul KV secret
    service_token: 'consul:services/myapp/token'
```

### 2. Import and configure `SecretsModule` in your `AppModule`:

```typescript
// app.module.ts
import {Module} from '@nestjs/common';
import {SecretsModule} from '@floracodex/nestjs-secrets';
import {SSMClient} from '@aws-sdk/client-ssm'; // Example for AWS Parameter Store
// No specific client import needed for Vault or Consul if using default env var configuration
// or if you pass options directly for Consul if not using env vars.

@Module({
    imports: [
        SecretsModule.forRoot({
            // Provide the SDK client for your secret provider if needed (e.g., AWS)
            // For Vault & Consul, client instantiation is handled by the respective providers
            // using environment variables or default options.
            // client: new SSMClient({region: 'us-east-1'}), // Example for AWS
            
            // Example: If you need to pass specific options to the Consul client:
            // providerOptions: {
            //   ConsulProvider: { host: 'my-consul.example.com', port: '8500', secure: true }
            // },
            
            files: ['settings.yaml'],
            isGlobal: true,
            cache: true
        })
    ]
})
export class AppModule {
}
```

_NestJS Secrets often auto-detects the provider from the client or secret format. See the [Cloud Provider Integration Guides on our Wiki](https://github.com/floracodex/nestjs-secrets/wiki/5.-Cloud-Provider-Integration-Guides) for specifics, including detailed guides for Hashicorp Vault and Consul._

### 3. Access configuration in your services:

```typescript
// any.service.ts
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class AnyService {
    constructor(private configService: ConfigService) {
        const dbPassword = this.configService.get<string>('db.password');
        const apiKey = this.configService.get<string>('db.api_key'); // Resolved from Vault
        const serviceToken = this.configService.get<string>('db.service_token'); // Resolved from Consul
        // Values now hold the resolved secret values
    }
}
```

For more detailed examples and explanations, please see the [Basic Usage Guide on our Wiki](https://github.com/floracodex/nestjs-secrets/wiki/4.-Basic-Usage-Guide).

## Advanced Usage
`NestJS Secrets` also supports custom secret providers and manual configuration for more complex scenarios.

Learn more in the [Advanced Usage section of our Wiki](https://github.com/floracodex/nestjs-secrets/wiki/6.-Advanced-Usage).

## Contributing
We welcome contributions! If you'd like to report a bug, suggest a feature, or contribute code (especially new secret providers), please see our [Contributing Guidelines on the Wiki](https://github.com/floracodex/nestjs-secrets/wiki/7.-Contributing-Guidelines).

## License

This project is licensed under the [MIT License](https://github.com/floracodex/nestjs-secrets/blob/main/LICENSE).
