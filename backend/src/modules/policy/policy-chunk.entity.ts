import {
  Column,
  DataType,
  Index,
  Model,
  Table,
  Unique,
} from 'sequelize-typescript';

@Table({
  tableName: 'policy_chunks',
  timestamps: true,
})
export class PolicyChunk extends Model {
  @Column({
    type: DataType.STRING(200),
    allowNull: false,
  })
  schemeName!: string;

  @Column({
    type: DataType.ENUM('scheme', 'law', 'policy'),
    defaultValue: 'scheme',
    allowNull: false,
  })
  category!: 'scheme' | 'law' | 'policy';

  @Column({
    type: DataType.STRING(60),
    allowNull: true,
  })
  state!: string | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    defaultValue: 'https://www.myscheme.gov.in',
  })
  sourceUrl!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  chunkIndex!: number;

  @Index({ type: 'FULLTEXT' })
  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  content!: string;

  @Column({
    type: DataType.JSON,
    allowNull: false,
  })
  embedding!: number[];

  @Unique('uq_scheme_chunk')
  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  contentKey!: string;
}
