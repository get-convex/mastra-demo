# Mastra + Convex exploration

Paused for now. Context: https://stack.convex.dev/reimplementing-mastra-regrets

Run these once to set it up:

```sh
pnpm i -D @libsql/client
echo '{"node":{"externalPackages":["@libsql/client"]}}' > convex.json
printf '"use node";\nexport * as _ from "@libsql/client";' > convex/_hax.ts
```

To iterate on Convex + Mastra in parallel:

```sh
pnpm run dev
```

FYI: when you edit Mastra files, they won't by default be picked up by the Convex dev server since they're not in the `convex/` directory.

```sh
npx convex run node.ts:a
```
