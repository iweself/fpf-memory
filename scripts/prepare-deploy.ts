import { stageDeployAssets, parseBuildConfigFromEnv } from '../src/build/stage-deploy-assets.js';

const manifest = await stageDeployAssets(parseBuildConfigFromEnv(process.env), process.env);

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
