import {Controller, Get} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Controller()
export class AppController {
    constructor(private readonly configService: ConfigService) {
    }

    @Get()
    get(): any {
        return {
            // The settings.local.yaml file overrides db.host and db.password -- which is great
            // for local development. You might keep user and database values the same between
            // environments but want the host and password to be different.
            'db.host': this.configService.get('db.host'),
            'db.password': this.configService.get('db.password'),

            // These come from settings.yaml, which is loaded before settings.local.yaml.
            'db.user': this.configService.get('db.user'),
            'db.database': this.configService.get('db.database')
        }
    }
}
