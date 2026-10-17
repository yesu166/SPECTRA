import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 5173;
const baseUrl = `http://${host}:${port}`;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const server = spawn(npm, ["run", "dev", "--", "--host", host, "--strictPort", "--port", String(port)], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
  env: { ...process.env, CI: "1" },
});

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite dev server exited early.\\n${serverOutput}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) { ready = true; break; }
    } catch { /* server is not ready yet */ }
    await delay(200);
  }
  if (!ready) throw new Error(`Timed out waiting for Vite dev server.\\n${serverOutput}`);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  const bodyText = await page.locator("body").innerText();
  const runtimeFailure = bodyText.includes("SPECTRA · RUNTIME ERROR") || bodyText.includes("The simulator failed to start");
  if (runtimeFailure || pageErrors.length > 0) {
    throw new Error([
      "SPECTRA browser smoke test failed.",
      runtimeFailure ? `Runtime error boundary content:\\n${bodyText.slice(0, 5000)}` : "",
      pageErrors.length ? `Page errors:\\n${pageErrors.join("\\n---\\n")}` : "",
      consoleErrors.length ? `Console errors:\\n${consoleErrors.join("\\n")}` : "",
    ].filter(Boolean).join("\\n\\n"));
  }

  const hasWorkspace = await page.getByText("Common operating picture", { exact: false }).count();
  if (!hasWorkspace) throw new Error(`Main training workspace did not render. Body text:\\n${bodyText.slice(0, 3000)}`);
  console.log("SPECTRA browser smoke test passed: main workspace rendered without page errors.");
  console.log(`Browser: Chromium ${browser.version()}`);
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
