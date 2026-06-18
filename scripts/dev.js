import { context } from 'esbuild';
import { exec } from 'node:child_process';

const PORT = 8000;

async function main() {
  const ctx = await context({ logLevel: 'info' });
  const { host, port } = await ctx.serve({ servedir: '.', port: PORT });

  const url = `http://${!host || host === '0.0.0.0' ? 'localhost' : host}:${port}`;
  console.log(`Serving at ${url}`);
  openBrowser(url);
}

function openBrowser(url) {
  const command =
    process.platform === 'darwin' ? `open "${url}"`
    : process.platform === 'win32' ? `start "" "${url}"`
    : `xdg-open "${url}"`;

  exec(command, (err) => {
    if (err) console.error(`Failed to open browser: ${err.message}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
