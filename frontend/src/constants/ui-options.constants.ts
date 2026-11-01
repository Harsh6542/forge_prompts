/** 10 languages the Sarvam pipeline supports end-to-end (STT/translate/TTS). */
export const LANGUAGE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
];

export const SERVICE_OPTIONS = [
  { value: 'scholarship', label: 'Scholarship (NSP)' },
  { value: 'pan_card', label: 'PAN Card (NSDL)' },
  { value: 'passport', label: 'Passport (Passport Seva)' },
  { value: 'ration_card', label: 'Ration Card (NFSA)' },
  { value: 'driving_license', label: 'Driving Licence (Sarathi)' },
  { value: 'income_certificate', label: 'Income Certificate (State)' },
];

export const CATEGORY_OPTIONS = [
  { value: 'road', label: 'Roads & potholes' },
  { value: 'water', label: 'Water supply' },
  { value: 'garbage', label: 'Garbage & sanitation' },
  { value: 'electricity', label: 'Electricity / streetlights' },
  { value: 'pollution', label: 'Pollution' },
  { value: 'flood', label: 'Flooding' },
  { value: 'other', label: 'Other' },
];
