import { Router } from 'express';
import type { AwilixContainer } from 'awilix';
import type TranscribeAudioController from '../controller/transcribe-audio.controllers.js';

export default function createTranscribeAudioRoutes(container: AwilixContainer) {
  const router = Router();
  const controller = container.resolve<TranscribeAudioController>("transcribeAudioController");
  router.post('/', controller.requestTranscription.bind(controller));
  return router;
}
