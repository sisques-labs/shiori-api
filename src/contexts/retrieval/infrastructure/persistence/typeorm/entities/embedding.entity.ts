import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EMBEDDING_VECTOR_DIMENSIONS } from '@contexts/retrieval/domain/value-objects/embedding-vector/embedding-vector.value-object';

@Entity('embeddings')
@Index('IDX_embeddings_knowledge_base_id', ['knowledgeBaseId'])
@Index('IDX_embeddings_document_id', ['documentId'])
export class EmbeddingTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'knowledge_base_id', type: 'uuid', nullable: false })
  knowledgeBaseId!: string;

  @Column({ name: 'document_id', type: 'uuid', nullable: false })
  documentId!: string;

  @Column({ name: 'chunk_id', type: 'uuid', nullable: false })
  chunkId!: string;

  @Column({ name: 'chunk_text', type: 'text', nullable: false })
  chunkText!: string;

  @Column({ name: 'chunk_position', type: 'int', nullable: false })
  chunkPosition!: number;

  @Column({ type: 'vector', length: EMBEDDING_VECTOR_DIMENSIONS })
  embedding!: number[];

  @Column({ name: 'model', type: 'varchar', length: 100, nullable: false })
  model!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
