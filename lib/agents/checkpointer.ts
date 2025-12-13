/**
 * Supabase Checkpointer for LangGraph
 *
 * Persists agent state to Supabase for resuming after interrupts
 */

import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata } from '@langchain/langgraph';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface CheckpointData {
  thread_id: string;
  checkpoint_id: string;
  parent_id: string | null;
  checkpoint: any;
  metadata: any;
  created_at: string;
}

export class SupabaseCheckpointer extends BaseCheckpointSaver {
  private supabase: SupabaseClient;
  private tableName: string;

  constructor(tableName: string = 'agent_checkpoints') {
    super();
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.tableName = tableName;
  }

  async getTuple(config: { configurable?: { thread_id?: string; checkpoint_id?: string } }): Promise<{
    config: { configurable: { thread_id: string; checkpoint_id: string } };
    checkpoint: Checkpoint;
    metadata: CheckpointMetadata;
    parentConfig?: { configurable: { thread_id: string; checkpoint_id: string } };
  } | undefined> {
    const threadId = config.configurable?.thread_id;
    const checkpointId = config.configurable?.checkpoint_id;

    if (!threadId) {
      return undefined;
    }

    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('thread_id', threadId);

    if (checkpointId) {
      query = query.eq('checkpoint_id', checkpointId);
    } else {
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return undefined;
    }

    const checkpointData = data as CheckpointData;

    return {
      config: {
        configurable: {
          thread_id: checkpointData.thread_id,
          checkpoint_id: checkpointData.checkpoint_id,
        },
      },
      checkpoint: checkpointData.checkpoint as Checkpoint,
      metadata: checkpointData.metadata as CheckpointMetadata,
      parentConfig: checkpointData.parent_id
        ? {
            configurable: {
              thread_id: checkpointData.thread_id,
              checkpoint_id: checkpointData.parent_id,
            },
          }
        : undefined,
    };
  }

  async *list(
    config: { configurable?: { thread_id?: string } },
    options?: { limit?: number; before?: string }
  ): AsyncGenerator<{
    config: { configurable: { thread_id: string; checkpoint_id: string } };
    checkpoint: Checkpoint;
    metadata: CheckpointMetadata;
    parentConfig?: { configurable: { thread_id: string; checkpoint_id: string } };
  }> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      return;
    }

    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.before) {
      query = query.lt('checkpoint_id', options.before);
    }

    const { data, error } = await query;

    if (error || !data) {
      return;
    }

    for (const row of data as CheckpointData[]) {
      yield {
        config: {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_id: row.checkpoint_id,
          },
        },
        checkpoint: row.checkpoint as Checkpoint,
        metadata: row.metadata as CheckpointMetadata,
        parentConfig: row.parent_id
          ? {
              configurable: {
                thread_id: row.thread_id,
                checkpoint_id: row.parent_id,
              },
            }
          : undefined,
      };
    }
  }

  async put(
    config: { configurable?: { thread_id?: string; checkpoint_id?: string } },
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<{ configurable: { thread_id: string; checkpoint_id: string } }> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error('Thread ID is required');
    }

    const checkpointId = `chk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const parentId = config.configurable?.checkpoint_id || null;

    const { error } = await this.supabase.from(this.tableName).insert({
      thread_id: threadId,
      checkpoint_id: checkpointId,
      parent_id: parentId,
      checkpoint: checkpoint,
      metadata: metadata,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to save checkpoint: ${error.message}`);
    }

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_id: checkpointId,
      },
    };
  }

  async delete(config: { configurable?: { thread_id?: string } }): Promise<void> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      return;
    }

    await this.supabase.from(this.tableName).delete().eq('thread_id', threadId);
  }
}

/**
 * Create a checkpointer instance
 */
export function createCheckpointer(): SupabaseCheckpointer {
  return new SupabaseCheckpointer('agent_checkpoints');
}
