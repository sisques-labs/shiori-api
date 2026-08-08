import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Pure metadata now — the vector itself lives in a separate
 * `embedding_vectors_{dimension}` table (see `embedding-vector-entity.factory.ts`),
 * FK'd back to this table's `id` with `ON DELETE CASCADE`. Every other
 * column, both existing FKs (to `documents`/`chunks`), and both existing
 * indexes are unchanged by the flexible-embedding-dimensions migration.
 */
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

  @Column({ name: 'model', type: 'varchar', length: 100, nullable: false })
  model!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
