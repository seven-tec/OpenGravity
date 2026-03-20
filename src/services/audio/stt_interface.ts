export interface STTResult {
  text?: string;
  language?: string;
  error?: string;
}

export interface ISTTService {
  isEnabled(): boolean;
  transcribeFile(audioPath: string, language?: string): Promise<STTResult>;
}
