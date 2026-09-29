const { spawnSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');
const rootEnv = dotenv.config({ path: path.resolve(__dirname, '../../../.env') }).parsed ?? {};
const cli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...rootEnv, ...process.env },
});
process.exit(result.status ?? 1);

