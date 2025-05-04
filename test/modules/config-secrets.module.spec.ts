import {Test, TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import * as path from 'path';
import {ConfigSecretsModule} from '../../src/modules/config-secrets2.module';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';

describe('ConfigSecretsModule', () => {
    const fixturesDir = path.join(__dirname, '..', 'fixtures');

    describe('forRoot', () => {
        it('should register the module without a secret provider', async () => {
            const module: TestingModule = await Test.createTestingModule({
                imports: [
                    ConfigSecretsModule.forRoot({
                        directory: fixturesDir,
                        files: ['local.yaml'],
                        isGlobal: true
                    })
                ]
            }).compile();

            const configService = module.get<ConfigService>(ConfigService);
            expect(configService).toBeDefined();
            expect(configService.get('app.name')).toEqual('TestApp');
        });
    });

    describe('forGoogleSecretManager', () => {
        it('should register the module with Google Secret Manager', async () => {
            // Mock Google Secret Manager Client
            const mockClient = {
                accessSecretVersion: jest.fn().mockResolvedValue([{
                    payload: {data: Buffer.from('secret-value')}
                }])
            } as unknown as jest.Mocked<SecretManagerServiceClient>;

            const module: TestingModule = await Test.createTestingModule({
                imports: [
                    ConfigSecretsModule.forGoogleSecretManager(
                        mockClient,
                        {
                            directory: fixturesDir,
                            files: ['local.yaml'],
                            isGlobal: true
                        }
                    )
                ]
            }).compile();

            const configService = module.get<ConfigService>(ConfigService);
            expect(configService).toBeDefined();
        });
    });

    // Similar tests for AWS and Azure providers
});
