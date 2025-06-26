// eslint-disable-next-line import/no-unresolved
import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersProject({
  test: {
    name: 'hyphalbase',
    poolOptions: {
      workers: {
        // singleWorker: true,
        // isolatedStorage: true,
        // miniflare: {
        //   unsafeEphemeralDurableObjects: true,
        //   durableObjects: {
        //     SQL: {
        //       className: 'SQLiteDurableObject',
        //       scriptName: 'hyphalbase',
        //     },
        //   },
        // },
        wrangler: {
          configPath: './wrangler.jsonc',
        },
      },
    },
  },
});
