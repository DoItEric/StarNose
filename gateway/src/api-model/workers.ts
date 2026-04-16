/** 对应 worker biz 库 worker_schedule 表 */
export interface WorkerSchedule {
  id: string;
  name: string;
  workerKind: string;
  workerType: string;
  enabled: boolean;
  sourceId: string;
  config: Record<string, unknown>;
  fetchConfig: Record<string, unknown>;
  maxInstances: number;
  timeoutSeconds: number;
  lastRunAt?: string | null;
  lastStatus?: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 对应 worker biz 库 worker_run_log 表 */
export interface WorkerRunLog {
  id: string;
  scheduleId: string;
  workerKind: string;
  workerType: string;
  startedAt: string;
  finishedAt?: string | null;
  status: string;
  itemsCount: number;
  elapsedMs: number;
  error?: string | null;
  context?: Record<string, unknown> | null;
}

export interface SaveWorkerScheduleRequest {
  id?: string;
  name: string;
  workerKind: string;
  workerType: string;
  enabled?: boolean;
  sourceId: string;
  config?: Record<string, unknown>;
  fetchConfig?: Record<string, unknown>;
  maxInstances?: number;
  timeoutSeconds?: number;
}

export interface ListWorkerRunLogsQuery {
  scheduleId?: string;
  status?: string;
  limit?: number;
}
