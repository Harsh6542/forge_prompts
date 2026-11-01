import {
  Column,
  Model,
  Table,
  DataType,
} from 'sequelize-typescript';

@Table({
  tableName: 'users',
  timestamps: true,
})
export class User extends Model {
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  name!: string;

  @Column({
    type: DataType.STRING(255),
    unique: true,
    allowNull: false,
  })
  email!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  passwordHash!: string;

  @Column({
    type: DataType.ENUM(
      'superadmin',
      'pwd_admin',
      'jalboard_admin',
      'municipal_admin',
      'disco_admin',
      'spcb_admin',
      'sma_admin',
      'public_user'
    ),
    defaultValue: 'public_user',
    allowNull: false,
  })
  role!:
    | 'superadmin'
    | 'pwd_admin'
    | 'jalboard_admin'
    | 'municipal_admin'
    | 'disco_admin'
    | 'spcb_admin'
    | 'sma_admin'
    | 'public_user';

  @Column({
    type: DataType.STRING(10),
    allowNull: true,
  })
  department!: string | null; // e.g., 'PWD', 'JalBoard', 'Municipal'; null for superadmin/public_user
}