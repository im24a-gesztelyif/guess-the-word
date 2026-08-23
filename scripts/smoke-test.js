const { spawn } = require("node:child_process");

const port = 3210;
const child = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (!response.ok) throw new Error(`Unexpected HTTP status ${response.status}`);
      const body = await response.text();
      if (!body.toLowerCase().includes("<!doctype html")) {
        throw new Error("Home page did not return the expected HTML document");
      }
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw new Error("Server did not become ready");
}

waitForServer()
  .then(() => {
    console.log("Smoke test passed");
    child.kill();
  })
  .catch((error) => {
    console.error(error);
    child.kill();
    process.exitCode = 1;
  });
