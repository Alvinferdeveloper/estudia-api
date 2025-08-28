import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('verification')
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'identifier', nullable: false })
  identifier: string;

  @Column('text', { name: 'value', nullable: false })
  value: string;

  @Column('date', { name: 'expiresAt', nullable: false })
  expiresAt: Date;

  @Column('date', { name: 'createdAt', nullable: true })
  createdAt: Date;

  @Column('date', { name: 'updatedAt', nullable: true })
  updatedAt: Date;

}