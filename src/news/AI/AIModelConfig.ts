export const AIModelConfig = {
  groq: {
    primary: 'llama-3.3-70b-versatile',
    fallback: 'llama-3.1-8b-instant',
    candidates: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant'
    ]
  },
  gemini: {
    primary: 'gemini-3.7-flash',
    fallback: 'gemini-3.1-flash-lite',
    candidates: [
      'gemini-3.7-flash',
      'gemini-3.1-flash-lite'
    ]
  }
};
