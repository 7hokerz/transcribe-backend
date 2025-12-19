
import { asClass, asValue, Lifetime } from "awilix";
import { bucket } from "#config/firebase-admin.js";
import { container } from "#config/container.js";
import GcsStorageClient from "#utils/gcs-storage.client.js";
import TranscriptionJobRepository from "../repository/transcription-job.repository.js";
import TranscriptionContentRepository from "../repository/transcription-content.repository.js";
import SessionService from "../service/session.service.js";
import FFprobeService from "../service/ffprobe.service.js";
import TranscribeService from "../service/transcribe.service.js";
import SessionQueue from "../queue/session.queue.js";
import FFprobeQueue from "../queue/ffprobe.queue.js";
import TranscribeQueue from "../queue/transcribe.queue.js";
import TranscribeAudioController from "../controller/transcribe-audio.controllers.js";

export const registerTranscription = () => {
    container.register({
        bucket: asValue(bucket),

        storage: asClass(GcsStorageClient, { lifetime: Lifetime.SINGLETON }),
        jobRepo: asClass(TranscriptionJobRepository, { lifetime: Lifetime.SINGLETON }),
        contentRepo: asClass(TranscriptionContentRepository, { lifetime: Lifetime.SINGLETON }),

        ffprobeSvc: asClass(FFprobeService, { lifetime: Lifetime.SINGLETON }),
        transcribeSvc: asClass(TranscribeService, { lifetime: Lifetime.SINGLETON }),
        sessionSvc: asClass(SessionService, { lifetime: Lifetime.SINGLETON }),

        ffprobeQueue: asClass(FFprobeQueue, { lifetime: Lifetime.SINGLETON }),
        transcribeQueue: asClass(TranscribeQueue, { lifetime: Lifetime.SINGLETON }),
        sessionQueue: asClass(SessionQueue, { lifetime: Lifetime.SINGLETON }),

        transcribeAudioController: asClass(TranscribeAudioController, { lifetime: Lifetime.SINGLETON }),
    });
}

