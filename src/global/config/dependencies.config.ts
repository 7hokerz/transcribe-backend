import { asClass, asValue, Lifetime } from "awilix";
import { container } from "#global/config/container.config.js";
import { bucket } from "#global/config/firebase.config.js";
import { TasksClient, TasksConfig } from "#global/config/cloud-tasks.config.js";
import GcsStorageClient from "#global/storage/gcs-storage.client.js";

export const registerInfra = () => {
    container.register({
        bucket: asValue(bucket),
        TasksClient: asValue(TasksClient),
        TasksConfig: asValue(TasksConfig),

        storage: asClass(GcsStorageClient, { lifetime: Lifetime.SINGLETON }),
    });
}