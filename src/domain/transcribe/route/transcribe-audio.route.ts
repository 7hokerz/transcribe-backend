import { Router } from 'express';
import TranscribeAudioRepository from '../repository/transcribe-audio.repository.js';
import TranscriptionContentRepository from '../repository/transcription-content.repository.js';
import TranscribeAudioController from '../controller/transcribe-audio.controllers.js';
import SessionQueue from "../queue/session.queue.js";
import SessionService from '../service/session.service.js';
import FFprobeQueue from '../queue/ffprobe.queue.js';
import TranscribeQueue from '../queue/transcribe.queue.js';
import FFprobeService from '../service/ffprobe.service.js';
import TranscribeService from '../service/transcribe.service.js';
import GcsStorageClient from '#utils/gcs-storage.client.js';
import { bucket } from '#config/firebase-admin.js';

const storage = new GcsStorageClient(bucket);

const transcribeAudioRepo = new TranscribeAudioRepository();
const transcriptionContentRepo = new TranscriptionContentRepository();

const ffprobeSvc = new FFprobeService(storage);
const transcribeSvc = new TranscribeService(storage);
const ffprobeQueue = new FFprobeQueue(ffprobeSvc);
const transcribeQueue = new TranscribeQueue(transcribeSvc);
const sessionSvc = new SessionService(ffprobeQueue, transcribeQueue, transcribeAudioRepo, transcriptionContentRepo, storage);
const sessionQueue = new SessionQueue(sessionSvc);
const transcribeAudioController = new TranscribeAudioController(sessionQueue);

const router = Router();

router.post('/', transcribeAudioController.transcribe.bind(transcribeAudioController));

export default router;