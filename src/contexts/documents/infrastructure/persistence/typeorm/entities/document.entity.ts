import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('documents')
@Index('IDX_documents_knowledge_base_id', ['knowledgeBaseId'])
export class DocumentTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'knowledge_base_id', type: 'uuid', nullable: false })
  knowledgeBaseId!: string;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ name: 'content', type: 'text', nullable: false })
  content!: string;

  @Column({ name: 'status', type: 'varchar', length: 16, nullable: false })
  status!: string;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ name: 'chunk_count', type: 'int', nullable: false, default: 0 })
  chunkCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
