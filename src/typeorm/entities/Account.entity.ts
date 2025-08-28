import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('account')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'accountId', nullable: false })
  accountId: string;

  @Column('text', { name: 'providerId', nullable: false })
  providerId: string;

  @Column('text', { name: 'userId', nullable: false })
  userId: string;

  @Column('text', { name: 'accessToken', nullable: true })
  accessToken: string;

  @Column('text', { name: 'refreshToken', nullable: true })
  refreshToken: string;

  @Column('text', { name: 'idToken', nullable: true })
  idToken: string;

  @Column('date', { name: 'accessTokenExpiresAt', nullable: true })
  accessTokenExpiresAt: Date;

  @Column('date', { name: 'refreshTokenExpiresAt', nullable: true })
  refreshTokenExpiresAt: Date;

  @Column('text', { name: 'scope', nullable: true })
  scope: string;

  @Column('text', { name: 'password', nullable: true })
  password: string;

  @Column('date', { name: 'createdAt', nullable: false })
  createdAt: Date;

  @Column('date', { name: 'updatedAt', nullable: false })
  updatedAt: Date;

}