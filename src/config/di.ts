import { asClass, asValue, Lifetime } from "awilix";
import { container } from "#config/container.js";
import { bucket } from "#config/firebase-admin.js";
import { TasksClient, TasksConfig } from "#config/google-cloud.config.js";
import GcsStorageClient from "#utils/gcs-storage.client.js";

export const registerInfra = () => {
    container.register({
        bucket: asValue(bucket),
        TasksClient: asValue(TasksClient),
        TasksConfig: asValue(TasksConfig),

        storage: asClass(GcsStorageClient, { lifetime: Lifetime.SINGLETON }),
    });
}