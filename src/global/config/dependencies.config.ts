import { asClass, asValue, Lifetime } from "awilix";
import { OAuth2Client } from 'google-auth-library';
import { container } from "#global/config/container.config.js";
import { bucket } from "#global/config/firebase.config.js";
import { TasksClient, TasksConfig } from "#global/config/cloud-tasks.config.js";
import GcsStorageClient from "#global/storage/gcs-storage.client.js";
import { ApiAuthMiddleware } from "#global/middleware/auth.middleware.js";
import { CloudTasksMiddleware } from "#global/middleware/cloud-tasks.middleware.js";

export const registerGlobal = () => {
    container.register({
        GcsBucket: asValue(bucket),
        TasksClient: asValue(TasksClient),
        TasksConfig: asValue(TasksConfig),
        oauth2Client: asValue(new OAuth2Client()),

        storage: asClass(GcsStorageClient, { lifetime: Lifetime.SINGLETON }),
        apiAuthMiddleware: asClass(ApiAuthMiddleware, { lifetime: Lifetime.SINGLETON }),
        cloudTasksMiddleware: asClass(CloudTasksMiddleware, { lifetime: Lifetime.SINGLETON }),
    });
}