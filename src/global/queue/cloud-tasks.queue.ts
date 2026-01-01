import { CloudTasksClient, protos } from "@google-cloud/tasks";
import type { CloudTasksConfig } from "#global/config/google-cloud.config.js";
import { mapToInfrastructureError } from "#global/exception/error-mapper.js";

export default class CloudTasksQueue {
  constructor(
    private readonly TasksClient: CloudTasksClient,
    private readonly TasksConfig: CloudTasksConfig,
  ) { }

  public async enqueue<T extends object>(payload: T, taskId: string) {
    const parent = this.buildParentPath();

    const task = this.buildTaskObject(payload, taskId);

    return this.submitTask(parent, task);
  }

  /**
   * 큐 경로 생성
   */
  private buildParentPath() {
    return this.TasksClient.queuePath(
      this.TasksConfig.projectId,
      this.TasksConfig.locationId,
      this.TasksConfig.queueId
    );
  }

  /**
   * Task 객체 생성
   */
  private buildTaskObject<T extends object>(payload: T, taskId: string): protos.google.cloud.tasks.v2.ITask {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');

    const taskName = this.TasksClient.taskPath(
      this.TasksConfig.projectId,
      this.TasksConfig.locationId,
      this.TasksConfig.queueId,
      taskId
    );

    return {
      name: taskName,
      httpRequest: {
        httpMethod: protos.google.cloud.tasks.v2.HttpMethod.POST,
        url: this.TasksConfig.workerUrl,
        headers: { "Content-Type": "application/json" },
        body,
        oidcToken: {
          serviceAccountEmail: this.TasksConfig.serviceAccountEmail,
        },
      }
    };
  }

  /**
   * Task 삽입 (API 호출)
   */
  private async submitTask(parent: string, task: protos.google.cloud.tasks.v2.ITask) {
    try {
      await this.TasksClient.createTask({ parent, task });
      return { taskName: task.name! };
    } catch (e: any) {
      if (e?.code === 6 || e?.code === 'ALREADY_EXISTS') {
        return { taskName: task.name! };
      }
      throw mapToInfrastructureError(e);
    }
  }
}
