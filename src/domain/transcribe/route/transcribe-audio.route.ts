import { Router } from 'express';
import type TranscribeAudioController from '../controller/transcribe-audio.controllers.js';
import type { AwilixContainer } from 'awilix';

export default function createTranscribeAudioRoutes(container: AwilixContainer) {
  const router = Router();
  const controller = container.resolve<TranscribeAudioController>("transcribeAudioController");
  router.post('/', controller.requestTranscription.bind(controller));
  return router;
}
