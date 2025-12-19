import { Router } from 'express';
import { container } from '#config/container.js';
import { registerTranscription } from '../container/transcription.register.js';
import TranscribeAudioController from '../controller/transcribe-audio.controllers.js';

registerTranscription();
const controller = container.resolve<TranscribeAudioController>("transcribeAudioController");

const router = Router();

router.post('/', controller.transcribe.bind(controller));

export default router;