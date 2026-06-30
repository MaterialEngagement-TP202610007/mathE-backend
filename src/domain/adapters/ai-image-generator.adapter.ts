export abstract class AIImageGeneratorAdapter {
  abstract generateImage(prompt: string): Promise<Buffer>;
}
