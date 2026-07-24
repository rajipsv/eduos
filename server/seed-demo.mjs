import { runDemoSeedCli } from './demo-seed.js';

runDemoSeedCli().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
