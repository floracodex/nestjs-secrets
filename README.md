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
* Extensible architecture to support custom secret providers.
* Seamless integration with the standard NestJS `ConfigService`.

## Installation

```bash
npm install @floracodex/nestjs-secrets @nestjs/config
```

## Requirements

* **Node.js:** `^18.x || ^20.x || ^22.x` (Node.js 18.x or newer is recommended, preferably an active LTS version as of May 2025)
* **NestJS:** Requires NestJS version `^10.0.0` or `^11.0.0`.
* `@nestjs/config`: Requires `@nestjs/config` version `^3.0.0` or `^4.0.0`.

## Quick Start

1. **Create a configuration file (e.g., `settings.yaml`):**

    ```yaml
    # settings.yaml
    db:
        host: db.example.com
        # Example: Native ARN for an AWS Parameter Store secret
        password: 'arn:aws:ssm:us-east-1:123456789012:parameter/myapplication/dev/db_password'
    ```
1. **Import and configure `SecretsModule` in your `AppModule`:**

    ```typescript
    // app.module.ts
    import {Module} from '@nestjs/common';
    import {SecretsModule} from '@floracodex/nestjs-secrets';
    import {SSMClient} from '@aws-sdk/client-ssm'; // Example for AWS Parameter Store
    
    @Module({
        imports: [
            SecretsModule.forRoot({
                // Provide the SDK client for your secret provider
                client: new SSMClient({region: 'us-east-1'}),
                files: ['settings.yaml'],
                isGlobal: true,
                cache: true
            })
        ]
    })
    export class AppModule {
    }
    ```

    _NestJS Secrets often auto-detects the provider from the client. See the [Cloud Provider Guides on our Wiki](https://github.com/floracodex/nestjs-secrets/wiki/5.-Cloud-Provider-Integration-Guides) for specifics._

1. **Access configuration in your services:**

    ```typescript
    // any.service.ts
    import {Injectable} from '@nestjs/common';
    import {ConfigService} from '@nestjs/config';
    
    @Injectable()
    export class AnyService {
        constructor(private configService: ConfigService) {
            const dbPassword = this.configService.get<string>('db.password');
            // db.password now holds the resolved secret value
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
