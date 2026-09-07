process.env.NODE_ENV = 'test';
// Unit tests must not inherit a developer's live service configuration.
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/documind_unit_test';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.GEMINI_API_KEY = 'test-key';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-sufficient-entropy';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
