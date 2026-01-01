import { asClass, asValue, Lifetime } from "awilix";
import { container } from "#global/config/container.config.js";
import { bucket } from "#global/config/firebase.config.js";
import { TasksClient, TasksConfig } from "#global/config/google-cloud.config.js";
import GcsStorageClient from "#storage/GcsManager.js";

export const registerInfra = () => {
    container.register({
        bucket: asValue(bucket),
        TasksClient: asValue(TasksClient),
        TasksConfig: asValue(TasksConfig),

        storage: asClass(GcsStorageClient, { lifetime: Lifetime.SINGLETON }),
    });
}