import { Router } from 'express';
import TranscribeAudioRepository from '#repositories/transcribe-audio.repository.js';
import TranscribeAudioController from '#controllers/transcribe-audio.controllers.js';
import SessionQueue from "#queues/session.queue.js";
import SessionService from '#services/session.service.js';
import FFprobeQueue from '#queues/ffprobe.queue.js';
import TranscribeQueue from '#queues/transcribe.queue.js';
import FFprobeService from '#services/ffprobe.service.js';
import TranscribeService from '#services/transcribe.service.js';

const router = Router();

const transcribeAudioRepo = new TranscribeAudioRepository();
const ffprobeSvc = new FFprobeService();
const transcribeSvc = new TranscribeService();
const ffprobeQueue = new FFprobeQueue(ffprobeSvc);
const transcribeQueue = new TranscribeQueue(transcribeSvc);
const sessionSvc = new SessionService(ffprobeQueue, transcribeQueue, transcribeAudioRepo);
const sessionQueue = new SessionQueue(sessionSvc);
const transcribeAudioController = new TranscribeAudioController(sessionQueue);

router.post('/', transcribeAudioController.transcribe.bind(transcribeAudioController));

export default router;