import { CloudTasksClient } from "@google-cloud/tasks";

export type CloudTasksConfig = {
  projectId: string;
  locationId: string;
  queueId: string;

  workerUrl: string;
  serviceAccountEmail: string;
};

export const TasksConfig: CloudTasksConfig = {
  projectId: 'quiz-whiz-hqbig',
  locationId: 'asia-east1',
  queueId: 'transcribe-audio',
  workerUrl: process.env.SERVER_URL! + '/internal/tasks/transcribe',
  serviceAccountEmail: process.env.TASK_SERVICE_ACCOUNT!,
}

export const TasksClient = new CloudTasksClient({ projectId: 'quiz-whiz-hqbig' });
