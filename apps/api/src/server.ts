import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './shared/db.js';

const server = app.listen(env.PORT, () => {
  console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
