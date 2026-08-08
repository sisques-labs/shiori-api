import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('knowledge_bases')
export class KnowledgeBaseTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Index('UQ_knowledge_bases_api_key_hash', { unique: true })
  @Column({
    name: 'api_key_hash',
    type: 'varchar',
    length: 64,
    nullable: false,
  })
  apiKeyHash!: string;

  @Column({
    name: 'embedding_model',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  embeddingModel!: string;

  @Column({
    name: 'embedding_status',
    type: 'varchar',
    length: 20,
    nullable: false,
    default: 'READY',
  })
  embeddingStatus!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
