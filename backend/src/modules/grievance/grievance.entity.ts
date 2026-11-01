import { Column, DataType, Index, Model, Table, Unique } from 'sequelize-typescript';

export type GrievanceCategory = 'road' | 'water' | 'garbage' | 'electricity' | 'pollution' | 'flood' | 'other';
export type GrievancePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type GrievanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

@Table({
  tableName: 'grievances',
  timestamps: true,
})
export class Grievance extends Model {
  @Unique('uq_grievance_tracking')
  @Index
  @Column({
    type: DataType.STRING(30),
    allowNull: false,
  })
  trackingId!: string;

  @Column({
    type: DataType.STRING(200),
    allowNull: true,
  })
  title!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  description!: string;

  @Column({
    type: DataType.ENUM('road', 'water', 'garbage', 'electricity', 'pollution', 'flood', 'other'),
    allowNull: false,
  })
  category!: GrievanceCategory;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  location!: string;

  @Column({
    type: DataType.STRING(60),
    allowNull: true,
  })
  state!: string | null;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
    defaultValue: 'en',
  })
  language!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  reportedById!: number | null;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    defaultValue: [],
  })
  mediaUrls!: string[];

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    defaultValue: 5,
  })
  finalSeverityScore!: number;

  @Column({
    type: DataType.ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
    allowNull: false,
  })
  priority!: GrievancePriority;

  @Column({
    type: DataType.STRING(120),
    allowNull: false,
  })
  assignedDepartment!: string;

  @Column({
    type: DataType.STRING(60),
    allowNull: false,
  })
  estimatedResolutionSla!: string;

  @Column({
    type: DataType.ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'),
    allowNull: false,
    defaultValue: 'OPEN',
  })
  status!: GrievanceStatus;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    defaultValue: {},
  })
  aiAnalysis!: Record<string, unknown>;
}
