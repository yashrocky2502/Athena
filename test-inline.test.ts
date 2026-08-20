import { test } from 'vitest';
test('logs env', () => {
  console.log("GROQ_PRIMARY_MODEL:", process.env.GROQ_PRIMARY_MODEL);
  console.log("GROQ_FALLBACK_MODEL:", process.env.GROQ_FALLBACK_MODEL);
});
