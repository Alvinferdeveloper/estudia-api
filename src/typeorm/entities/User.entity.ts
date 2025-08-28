import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'name', nullable: false })
  name: string;

  @Column('varchar', { name: 'email', nullable: false, unique: true, length: 255 })
  email: string;

  @Column('integer', { name: 'emailVerified', nullable: false })
  emailVerified: boolean;

  @Column('text', { name: 'image', nullable: true })
  image: string;

  @Column('date', { name: 'createdAt', nullable: false })
  createdAt: Date;

  @Column('date', { name: 'updatedAt', nullable: false })
  updatedAt: Date;

}