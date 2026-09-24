import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { calibrate } from './calibrate.ts';
import { loadData, MANIFEST, prepareData, ROOT } from './data.ts';
import { evaluate } from './evaluate.ts';
import { infer, loadResponses } from './infer.ts';
import type { Split } from './config.ts';

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function usage(): never {
  throw new Error('Usage: node --experimental-strip-types src/cli.ts <prepare|infer|calibrate|evaluate|status> [--split dev|test] [--pilot N] [--concurrency N] [--env-file PATH]');
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) usage();
  if (command === 'prepare') {
    await prepareData();
    console.log(`Prepared and validated pinned inputs; manifest: ${MANIFEST}`);
    return;
  }
  if (!existsSync(MANIFEST)) throw new Error('Run prepare before this command');
  const data = loadData();
  if (command === 'infer') {
    const split = option(args, '--split') as Split | undefined;
    if (split !== 'dev' && split !== 'test') usage();
    const pilotText = option(args, '--pilot');
    const concurrencyText = option(args, '--concurrency');
    await infer(data, split, {
      pilot: pilotText === undefined ? undefined : Number(pilotText),
      concurrency: concurrencyText === undefined ? undefined : Number(concurrencyText),
      envFile: option(args, '--env-file') ?? join(ROOT, '.env'),
    });
    return;
  }
  if (command === 'calibrate') {
    const result = calibrate(data, loadResponses(data, 'dev'));
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'evaluate') {
    const result = await evaluate(data);
    console.log(`Report: ${join(ROOT, 'results', 'report.md')}; paper comparison reproduced: ${result.paperComparison.comparable}`);
    return;
  }
  if (command === 'status') {
    for (const split of ['dev', 'test'] as const) {
      try {
        loadResponses(data, split);
        console.log(`${split}: complete (${data[split].size}/${data[split].size})`);
      } catch (error) {
        console.log(`${split}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log(`.env: ${existsSync(join(ROOT, '.env')) ? 'present' : 'absent'}`);
    return;
  }
  usage();
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
