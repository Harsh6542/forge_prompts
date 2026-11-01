import { ConfigService } from '@nestjs/config';
import { SequelizeModuleOptions } from '@nestjs/sequelize';

export const getDatabaseConfig = async (
  configService: ConfigService,
): Promise<SequelizeModuleOptions> => ({
  dialect: 'mysql',
  host: configService.get<string>('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME'),
  autoLoadModels: true,
  synchronize: configService.get('DB_SYNC') === 'true',
  logging: false,
});
