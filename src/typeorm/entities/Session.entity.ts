import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('session')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('date', { name: 'expiresAt', nullable: false })
  expiresAt: Date;

  @Column('varchar', { name: 'token', nullable: false, unique: true, length: 255 })
  token: string;

  @Column('date', { name: 'createdAt', nullable: false })
  createdAt: Date;

  @Column('date', { name: 'updatedAt', nullable: false })
  updatedAt: Date;

  @Column('text', { name: 'ipAddress', nullable: true })
  ipAddress: string;

  @Column('text', { name: 'userAgent', nullable: true })
  userAgent: string;

  @Column('text', { name: 'userId', nullable: false })
  userId: string;

}