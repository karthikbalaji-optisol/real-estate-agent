import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  url: string;

  @Column({ nullable: true })
  bhk: number;

  @Column({ nullable: true })
  bathrooms: number;

  @Column({ nullable: true })
  price: string;

  @Column({ name: 'plot_area', nullable: true })
  plotArea: string;

  @Column({ name: 'built_up_area', nullable: true })
  builtUpArea: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  facing: string;

  @Column({ nullable: true })
  floors: number;

  @Column({ name: 'source_email', nullable: true })
  sourceEmail: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
