# NestJS Config Secrets

A cloud-agnostic configuration loader for NestJS with secret management integration.

## Features

- Load configuration from YAML or JSON files
- Merge multiple configuration files with precedence
- Resolve secrets from various cloud providers:
    - Google Cloud Secret Manager
    - AWS Secrets Manager
    - Azure Key Vault
- Extensible architecture to support custom secret providers

## Installation

```bash
npm install nest-config-secrets

# Install optional peer dependencies based on your cloud provider
npm install @google-cloud/secret-manager # For Google Cloud
# or
npm install aws-sdk # For AWS
# or
npm install @azure/keyvault-secrets # For Azure
```


## Usage
### Basic Usage with No Secrets

```typescript
import { Module } from '@nestjs/common';
import { ConfigSecretsModule } from 'nest-config-secrets';
import { join } from 'path';

@Module({
  imports: [
    ConfigSecretsModule.forRoot({
      baseDirectory: join(__dirname, 'config'),
      configFiles: ['default.yaml', 'production.yaml'],
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

### Using with Google Cloud Secret Manager
```typescript
import { Module } from '@nestjs/common';
import { ConfigSecretsModule } from 'nest-config-secrets';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { join } from 'path';

@Module({
  imports: [
    ConfigSecretsModule.forGoogleSecretManager(
      new SecretManagerServiceClient(),
      {
        baseDirectory: join(__dirname, 'config'),
        configFiles: ['default.yaml', 'secrets.yaml'],
        isGlobal: true,
      }
    ),
  ],
})
export class AppModule {}
```

### Using with AWS Secrets Manager
```typescript
import { Module } from '@nestjs/common';
import { ConfigSecretsModule } from 'nest-config-secrets';
import { SecretsManager } from 'aws-sdk';
import { join } from 'path';

@Module({
  imports: [
    ConfigSecretsModule.forAwsSecretsManager(
      new SecretsManager({
        region: 'us-east-1',
      }),
      {
        baseDirectory: join(__dirname, 'config'),
        configFiles: ['default.yaml', 'secrets.yaml'],
        isGlobal: true,
      }
    ),
  ],
})
export class AppModule {}
```


### Using with Azure Key Vault
```typescript
import { Module } from '@nestjs/common';
import { ConfigSecretsModule } from 'nest-config-secrets';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { join } from 'path';

const client = new SecretClient(
  'https://your-vault.vault.azure.net',
  new DefaultAzureCredential()
);

@Module({
  imports: [
    ConfigSecretsModule.forAzureKeyVault(
      client,
      {
        baseDirectory: join(__dirname, 'config'),
        configFiles: ['default.yaml', 'secrets.yaml'],
        isGlobal: true,
      }
    ),
  ],
})
export class AppModule {}
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
      baseDirectory: join(__dirname, 'config'),
      configFiles: ['default.yaml', 'secrets.yaml'],
      secretProvider: new CustomSecretProvider(),
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```
