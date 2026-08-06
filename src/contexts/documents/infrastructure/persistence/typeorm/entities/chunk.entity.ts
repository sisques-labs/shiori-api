import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('chunks')
@Index('IDX_chunks_document_id', ['documentId'])
@Index('IDX_chunks_knowledge_base_id', ['knowledgeBaseId'])
export class ChunkTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid', nullable: false })
  documentId!: string;

  @Column({ name: 'knowledge_base_id', type: 'uuid', nullable: false })
  knowledgeBaseId!: string;

  @Column({ name: 'position', type: 'int', nullable: false })
  position!: number;

  @Column({ name: 'text', type: 'text', nullable: false })
  text!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
