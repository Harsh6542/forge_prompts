export interface UnifiedCitizenInputContext {
  normalizedEnglishText: string;
  originalInputType: 'text' | 'audio' | 'image' | 'video';
  detectedSourceLanguage: string;
  translationWasApplied: boolean;
  uploadedMediaCloudinaryUrl: string | null;
  extractedAudioTranscript: string | null;
  extractedVisualDescription: string | null;
  extractedVideoFrameUrls: string[];
  sttTranscriptionConfidenceScore: number | null;
  targetResponseLanguageCode: string;
}

export interface SarvamTranscription {
  transcript: string;
  languageCode: string;
  confidence: number | null;
}
