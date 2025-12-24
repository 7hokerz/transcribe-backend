import { CloudTasksClient, protos } from "@google-cloud/tasks";
import type { StartTranscriptionRequestDto } from "../dto/transcribe.request.dto.js";
import type { CloudTasksConfig } from "#config/google-cloud.config.js";
import { mapToInfrastructureError } from "#utils/error-mapper.js";

export default class CloudTasksSessionQueue {
  constructor(
    private readonly TasksClient: CloudTasksClient,
    private readonly TasksConfig: CloudTasksConfig,
  ) { }

  public async enqueue(dto: StartTranscriptionRequestDto) {
    const parent = this.TasksClient.queuePath(this.TasksConfig.projectId, this.TasksConfig.locationId, this.TasksConfig.queueId);

    const body = Buffer.from(JSON.stringify(dto)).toString('base64');

    const taskId = `transcribe-${dto.sessionId}`;
    const taskName = this.TasksClient.taskPath(this.TasksConfig.projectId, this.TasksConfig.locationId, this.TasksConfig.queueId, taskId);

    const task: protos.google.cloud.tasks.v2.ITask = {
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

    try {
      await this.TasksClient.createTask({ parent, task });
      return { taskName };
    } catch (e: any) {
      if (e?.code === 6 || e?.code === 'ALREADY_EXISTS') {
        return { taskName };
      }

      throw mapToInfrastructureError(e);
    }
  }
}
