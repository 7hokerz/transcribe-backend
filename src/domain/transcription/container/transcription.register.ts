
import { asClass, Lifetime } from "awilix";
import { container } from "#global/config/container.config.js";
import TranscriptionJobRepository from "../repository/transcription-job.repository.js";
import TranscriptionContentRepository from "../repository/transcription-content.repository.js";
import SessionService from "../service/session.service.js";
import FFprobeService from "../service/ffprobe.service.js";
import TranscribeService from "../service/transcribe.service.js";
import FFprobeQueue from "../queue/ffprobe.queue.js";
import TranscribeQueue from "../queue/transcribe.queue.js";
import TranscribeAudioController from "../controller/transcribe-audio.controllers.js";
import CloudTasksSessionQueue from "../queue/cloud-tasks.session.queue.js";
import RequestTranscriptionService from "../service/request-transcription.service.js";

export const registerTranscription = () => {
    container.register({
        jobRepo: asClass(TranscriptionJobRepository, { lifetime: Lifetime.SINGLETON }),
        contentRepo: asClass(TranscriptionContentRepository, { lifetime: Lifetime.SINGLETON }),

        ffprobeSvc: asClass(FFprobeService, { lifetime: Lifetime.SINGLETON }),
        transcribeSvc: asClass(TranscribeService, { lifetime: Lifetime.SINGLETON }),
        sessionSvc: asClass(SessionService, { lifetime: Lifetime.SINGLETON }),
        reqTranscriptionSvc: asClass(RequestTranscriptionService, { lifetime: Lifetime.SINGLETON }),

        ffprobeQueue: asClass(FFprobeQueue, { lifetime: Lifetime.SINGLETON }),
        transcribeQueue: asClass(TranscribeQueue, { lifetime: Lifetime.SINGLETON }),
        sessionQueue: asClass(CloudTasksSessionQueue, { lifetime: Lifetime.SINGLETON }),

        transcribeAudioController: asClass(TranscribeAudioController, { lifetime: Lifetime.SINGLETON }),
    });
}
