import { Column, DataType, Model, Table } from 'sequelize-typescript';

export type FactCheckVerdict = 'TRUE' | 'FALSE' | 'MISLEADING' | 'UNVERIFIED' | 'SATIRE';

@Table({
  tableName: 'fact_checks',
  timestamps: true,
})
export class FactCheck extends Model {
  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  content!: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
  })
  mediaUrl!: string | null;

  @Column({
    type: DataType.STRING(30),
    allowNull: false,
    defaultValue: 'other',
  })
  claimType!: string;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    defaultValue: [],
  })
  claims!: string[];

  @Column({
    type: DataType.JSON,
    allowNull: false,
    defaultValue: [],
  })
  namedEntities!: string[];

  @Column({
    type: DataType.JSON,
    allowNull: false,
    defaultValue: [],
  })
  redFlags!: string[];

  @Column({
    type: DataType.ENUM('TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIED', 'SATIRE'),
    allowNull: false,
  })
  verdict!: FactCheckVerdict;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    defaultValue: 0,
  })
  confidence!: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  reasoning!: string;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    defaultValue: [],
  })
  evidence!: unknown[];

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  deepfakeScore!: number | null;
}
