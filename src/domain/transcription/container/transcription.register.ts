
import { asClass, Lifetime } from "awilix";
import { container } from "#global/config/container.config.js";
import CloudTasksQueue from "#global/queue/cloud-tasks.queue.js";
import TranscriptionJobRepository from "../repository/transcription-job.repository.js";
import TranscriptionContentRepository from "../repository/transcription-content.repository.js";
import SessionService from "../service/session.service.js";
import FFprobeService from "../service/ffprobe.service.js";
import FFmpegSerivce from "../service/ffmpeg.service.js";
import TranscribeService from "../service/transcribe.service.js";
import RequestTranscriptionService from "../service/request-transcription.service.js";
import FFprobeQueue from "../queue/ffprobe.queue.js";
import FFmpegQueue from "../queue/ffmpeg.queue.js";
import TranscribeQueue from "../queue/transcribe.queue.js";
import TranscribeAudioController from "../controller/transcribe-audio.controllers.js";

export const registerTranscription = () => {
    container.register({
        jobRepo: asClass(TranscriptionJobRepository, { lifetime: Lifetime.SINGLETON }),
        contentRepo: asClass(TranscriptionContentRepository, { lifetime: Lifetime.SINGLETON }),

        ffprobeSvc: asClass(FFprobeService, { lifetime: Lifetime.SINGLETON }),
        ffmpegSvc: asClass(FFmpegSerivce, { lifetime: Lifetime.SINGLETON }),
        transcribeSvc: asClass(TranscribeService, { lifetime: Lifetime.SINGLETON }),
        sessionSvc: asClass(SessionService, { lifetime: Lifetime.SINGLETON }),
        reqTranscriptionSvc: asClass(RequestTranscriptionService, { lifetime: Lifetime.SINGLETON }),

        ffprobeQueue: asClass(FFprobeQueue, { lifetime: Lifetime.SINGLETON }),
        ffmpegQueue: asClass(FFmpegQueue, { lifetime: Lifetime.SINGLETON }),
        transcribeQueue: asClass(TranscribeQueue, { lifetime: Lifetime.SINGLETON }),
        sessionQueue: asClass(CloudTasksQueue, { lifetime: Lifetime.SINGLETON }),

        transcribeAudioController: asClass(TranscribeAudioController, { lifetime: Lifetime.SINGLETON }),
    });
}
