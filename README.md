# NestJS Secrets: Simplifying Configuration Management with Secrets Integration

## Why This Library Exists
Configuration management is a necessary part of developing applications. As applications grow and move between cloud environments, managing configuration and secrets becomes increasingly complex. NestJS provides a solid configuration system through its `ConfigModule`, but connecting it with secret management services often requires adopting an opinionated API from a library developer, or worse, writing custom code yourself.

NestJS Secrets bridges this gap by providing an adapter layer between NestJS's existing configuration system and popular cloud secret management services. It doesn't try to reinvent the wheel - instead, it builds upon the foundation that NestJS developers are already familiar with.

### The Problem It Solves
When building NestJS applications that need to access secrets from cloud providers, developers typically face these challenges:

1. **Manual integration with secret managers**: Writing custom code to fetch secrets from AWS, Google Cloud, or Azure
1. **Configuration structure**: Managing configuration across different environments
1. **Mixing code and configuration**: Keeping sensitive information out of source control
2. **Provider lock-in**: Being tied to a specific cloud provider's implementation

These challenges usually lead to custom solutions that aren't reusable across projects and require maintenance over time.

## What NestJS Secrets Does
NestJS Secrets solves these problems by providing:

1. **Unified access to secret services**: A consistent interface for AWS Parameter Store, AWS Secrets Manager, Google Cloud Secret Manager, and Azure Key Vault.
1. **Integration with NestJS ConfigService**: Works with the standard NestJS configuration system
1. **Configuration file loading**: Support for YAML and JSON configuration files
1. **Environment-specific configuration**: Merge multiple configuration files with precedence rules
1. **Automatic secret resolution**: Transparently resolve secret references in your configuration

Rather than completely replacing how you manage configuration, NestJS Secrets enhances the existing NestJS approach with cloud provider integration.
## How It Works
At its core, NestJS Secrets works by:
1. Loading configuration from YAML or JSON files
2. Detecting references to secrets in the configuration
3. Resolving those references by fetching the actual values from cloud provider secret managers
4. Creating a standard NestJS ConfigService with the resolved values

This approach allows you to write configuration files that reference secrets without including the actual secret values:
``` yaml
# settings.yaml
database:
  host: db.example.com
  port: 5432
  username: db-user
  # This is a reference to a secret, not the actual value
  password: ssm:/my-app/db-password
```
When your application starts, NestJS Secrets processes this file, detects the `ssm:/` reference, and fetches the actual password from AWS Parameter Store. Your application code simply uses the ConfigService as usual:
``` typescript
@Injectable()
export class DatabaseService {
  constructor(private configService: ConfigService) {
    const dbConfig = {
      host: this.configService.get('database.host'),
      port: this.configService.get('database.port'),
      username: this.configService.get('database.username'),
      password: this.configService.get('database.password'), // Already resolved!
    };
    // Use dbConfig...
  }
}
```
## Practical Use Cases
### Multi-Environment Applications
For applications deployed across development, testing, and production environments, NestJS Secrets allows you to:
- Share common configuration across environments
- Override specific values for each environment
- Keep sensitive information out of your code repository

For example, you might have:
- : Common configuration shared across environments `settings.yaml`
- `settings.dev.yaml`: Development-specific overrides
- `settings.prod.yaml`: Production-specific overrides

### Cloud-Deployed Applications
When deploying to cloud providers, NestJS Secrets helps you:
- Access provider-specific secret management services
- Keep sensitive data secure using managed services
- Maintain a consistent approach across different providers

### Microservices
In microservice architectures, NestJS Secrets enables:
- Consistent configuration patterns across services
- Centralized secret management
- Service-specific configuration when needed



# NestJS Secrets

A cloud-agnostic configuration loader for NestJS with secret management integration.

## Features

- Load configuration from YAML or JSON files
- Merge multiple configuration files with precedence
- Resolve secrets from various cloud providers:
    - Google Cloud Secret Manager
    - AWS Parameter Store
    - AWS Secrets Manager
    - Azure Key Vault
- Extensible architecture to support custom secret providers

## Installation

```bash
npm install @floracodex/nestjs-secrets @nestjs/config
```

### Install optional peer dependencies based on your cloud provider

#### AWS
```bash
npm install @aws-sdk/client-ssm
# or
npm install @aws-sdk/client-secrets-manager
```

#### Azure
```bash
npm install @azure/keyvault-secrets
# and probably this 
npm install @azure/identity 
```

#### Google Cloud
```bash
npm install @google-cloud/secret-manager
```


## Usage
### Basic Usage with No Secrets

```typescript
import {Module} from '@nestjs/common';
import {SecretsModule} from '@floracodex/nestjs-secrets';

@Module({
    imports: [
        SecretsModule.forRoot({
            root: './',
            files: ['settings.yaml', 'settings.local.yaml'],
            
            // Also available are the options defined by Nest's ConfigModule 
            isGlobal: true,
            cache: true
        })
    ]
})
export class AppModule {
}
```

### Using with Secrets
Let's show an example using Google Cloud's Secret Manager.
```typescript
import {Module} from '@nestjs/common';
import {SecretsModule} from '@floracodex/nestjs-secrets';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';

@Module({
    imports: [
        SecretsModule.forRoot({
            provider: 'GoogleSecretManagerProvider',
            client: new SecretManagerServiceClient(),
            root: './',
            files: ['settings.yaml', 'settings.local.yaml']
        })
    ]
})
export class AppModule {
}
```


```typescript
import {Module} from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {SSMClient} from '@aws-sdk/client-ssm';
import {SecretsLoaderService} from '@floracodex/nestjs-secrets';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            cache: true
        })
    ],
    providers: [
        {
            provide: ConfigService,
            useFactory: (client: SSMClient) => {
                const service = new SecretsLoaderService();
                return service.load({
                    provider: 'AwsParameterStoreProvider',
                    client: client,
                    root: './',
                    files: ['settings.yaml', 'settings.local.yaml']
                })
            },
            inject: [
                SSMClient
            ]
        },
        {
            provide: SSMClient,
            useFactory: () => new SSMClient({
                region: 'us-east-1'
            })
        }
    ]
})
export class AppModule {
}
```

### Creating a Custom Secret Provider
```typescript
import { Injectable } from '@nestjs/common';
import { SecretProvider, ConfigSecretsModule } from 'nest-config-secrets';
import { join } from 'path';

@Injectable()
export class CustomSecretProvider implements SecretProvider {
  isSecretReference(value: string): boolean {
    return value.startsWith('secret://');
  }

  async resolveSecret(secretRef: string): Promise<string | string[]> {
    // Extract the secret name from the reference
    const secretName = secretRef.replace('secret://', '');
    
    // Implement your secret resolution logic here
    return `resolved-value-for-${secretName}`;
  }
}

// Then in your module:
@Module({
  imports: [
    ConfigSecretsModule.forRoot({
        provider: new CustomSecretProvider(),
        root: './',
        files: ['settings.yaml', 'settings.local.yaml']
    }),
  ],
})
export class AppModule {}
```

## Advanced Configuration Options

### File Loading Options

| Option | Type | Description |
|--------|------|-------------|
| `root` | string | Base directory for config files. Defaults to project root. |
| `files` | string[] | Array of filenames to load. Files loaded in order with later files taking precedence. |
| `fileType` | 'yaml' \| 'json' | Default format for config files. Will be inferred from extension if not specified. |

### Secret Provider Options

| Option | Type | Description |
|--------|------|-------------|
| `provider` | string \| SecretsProvider | Secret provider type identifier or provider instance |
| `client` | any | Initialized client for the secret provider |

### ConfigModule Options

You can use any [ConfigModuleOptions](https://github.com/nestjs/config/blob/master/lib/interfaces/config-module-options.interface.ts) from `@nestjs/config` when importing this library using `SecretModule.forRoot()`. Including two of the most important:

| Option | Type | Description |
|--------|------|-------------|
| `isGlobal` | boolean | Make configuration globally available |
| `cache` | boolean | Cache configuration values |

Remember to use `ConfigModule` in lieu of `SecretModule` in your `imports` array when using DI to provide `ConfigService` directly in the `providers` array.   

## Closing Thoughts
NestJS Secrets doesn't try to revolutionize how you manage configuration - it simply makes connecting to cloud provider secret services easier while working with NestJS's existing patterns. By reducing the boilerplate code needed to securely manage configuration, it helps you focus on building your application rather than maintaining configuration infrastructure.
Whether you're building a simple service or a complex microservice architecture, NestJS Secrets provides a consistent, secure way to manage configuration across environments and cloud providers.
