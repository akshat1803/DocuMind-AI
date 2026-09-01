process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/documind_test';
process.env.GEMINI_API_KEY ??= 'test-key';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-with-sufficient-entropy';
