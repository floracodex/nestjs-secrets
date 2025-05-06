import {Test, TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import * as path from 'path';
import {SecretsModule} from '../../src';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';

describe('SecretConfigModule', () => {
    const fixturesDir = path.join(__dirname, '..', 'fixtures');

    describe('forRoot', () => {
        it('should register the module without a secret provider', async () => {
            const module: TestingModule = await Test.createTestingModule({
                imports: [
                    SecretsModule.forRoot({
                        root: fixturesDir,
                        files: ['local.yaml']
                    })
                ]
            }).compile();

            const configService = module.get<ConfigService>(ConfigService);
            expect(configService).toBeDefined();
            expect(configService.get('app.name')).toEqual('TestApp');
        });

        it('should register the module with Google Secret Manager', async () => {
            // Mock Google Secret Manager Client
            const mockClient = {
                accessSecretVersion: jest.fn().mockResolvedValue([{
                    payload: {data: Buffer.from('secret-value')}
                }])
            } as unknown as jest.Mocked<SecretManagerServiceClient>;

            const module: TestingModule = await Test.createTestingModule({
                imports: [
                    SecretsModule.forRoot({
                        provider: 'GoogleSecretManagerProvider',
                        client: mockClient,
                        root: fixturesDir,
                        files: ['secrets.yaml'],
                    })
                ]
            }).compile();

            const configService = module.get<ConfigService>(ConfigService);
            expect(configService).toBeDefined();
            expect(configService.get('google-secret-manager')).toEqual('secret-value');
        });
    });

    // describe('forGoogleSecretManager', () => {
    //     it('should register the module with Google Secret Manager', async () => {
    //         // Mock Google Secret Manager Client
    //         const mockClient = {
    //             accessSecretVersion: jest.fn().mockResolvedValue([{
    //                 payload: {data: Buffer.from('secret-value')}
    //             }])
    //         } as unknown as jest.Mocked<SecretManagerServiceClient>;
    //
    //         const module: TestingModule = await Test.createTestingModule({
    //             imports: [
    //                 SecretConfigModule.forRoot({
    //                     provider: 'GoogleSecretManagerProvider',
    //                     client: mockClient,
    //                     directory: fixturesDir,
    //                     files: ['secrets.yaml'],
    //                     isGlobal: true
    //                 })
    //             ]
    //         }).compile();
    //
    //         const configService = module.get<ConfigService>(ConfigService);
    //         expect(configService).toBeDefined();
    //         expect(configService.get('google-secret-manager')).toEqual('secret-value');
    //     });
    // });

    // Similar tests for AWS and Azure providers
});
