// Test and offline doubles for the harness (NooblyJS Phase 27): a scripted mock provider and the echo provider.
// They are not part of the public API in src/index.js, so nothing ships a mock by importing the library. Import them
// as 'nooblyjs-ai-harness/testing.js'. The echo provider is refused when NODE_ENV=production.
export { createMockProvider } from './src/providers/mock.js';
export { createEchoProvider } from './src/providers/echo.js';
