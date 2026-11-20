// NooblyJS Cloud: starts the app (src/app.js) on PORT (default 11010).
//
//   npm start                  http://localhost:11010 (sign up at /, or /dev/login outside production)
//   npm run seed [-- --reset]  writes the seed story (infrastructure, then services and GitHub) into DATA_DIR and exits
//   node app.js --operator <email> <platform|support|none>   grants (or removes) an operator role and exits
import { createApp } from './src/app.js';
import { loadConfig } from './src/config.js';

const argv = process.argv.slice(2);
const args = new Set(argv);
const config = loadConfig();

let hero;
try {
  hero = await createApp({ config, seed: !args.has('--seed') });
} catch (err) {
  console.error(`NooblyJS Cloud could not start: ${err.message}`);
  process.exit(1);
}

if (args.has('--operator')) {
  const [email, role] = argv.slice(argv.indexOf('--operator') + 1);
  try {
    const person = await hero.setOperator(email, role);
    console.log(`${person.email} is ${person.operator ? `an operator (${person.operator})` : 'not an operator'}.`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
  await hero.shutdown();
  process.exit();
}

if (args.has('--seed')) {
  await hero.accelerators.mounted.infrastructure.seed({ reset: args.has('--reset') });
  const result = await hero.seedRecords({ reset: args.has('--reset') });
  console.log(`Seeded ${config.dataDir}${args.has('--reset') ? ' (reset)' : ''}: ${result.skipped ? `services ${result.skipped}` : `${result.services} services, ${result.deploys} deploys, GitHub as stevie`}.`);
  await hero.shutdown();
  process.exit(0);
}

// Express 5 hands a listen failure (such as the port being taken by another copy of this app) to this callback, not
// to a crash: stop everything, the local agent with it, rather than run without a port.
const server = hero.app.listen(config.port, async (err) => {
  if (err) {
    console.error(`Could not listen on port ${config.port}: ${err.code === 'EADDRINUSE' ? 'something else is using it (another copy of this app?)' : err.message}`);
    await hero.shutdown();
    process.exit(1);
  }
  console.log(`NooblyJS Cloud on ${config.publicUrl} (data in ${config.dataDir})`);
});
// Local servers' agents connect to /infrastructure/agent/v1 over a WebSocket (infra spec 8.9).
hero.attachUpgrades(server);

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: stopping`);
  server.close();
  await hero.shutdown();
  process.exit(0);
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
