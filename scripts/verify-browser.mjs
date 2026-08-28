import puppeteer from "puppeteer-core";

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const url = "http://127.0.0.1:5173/";

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: [
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--no-sandbox",
    "--window-size=1440,900",
  ],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

try {
  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.__gravityDice), { timeout: 15000 });

  const boot = await page.evaluate(() => {
    const canvas = document.querySelector("#scene");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      canvas: { w: canvas.width, h: canvas.height },
      webgl: Boolean(gl),
      renderer: gl ? gl.getParameter(gl.RENDERER) : null,
      gravity: window.__gravityDice.gravity(),
      settled: window.__gravityDice.settled(),
      faces: window.__gravityDice.faces(),
    };
  });
  console.log("boot", JSON.stringify(boot, null, 2));

  await page.screenshot({ path: "verify-idle.png" });

  await page.click("#roll");
  await page.waitForFunction(() => window.__gravityDice.rolling() === true, { timeout: 5000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: "verify-rolling.png" });

  await page.waitForFunction(
    () => window.__gravityDice.rolling() === false && document.querySelectorAll(".face").length > 0,
    { timeout: 25000 },
  );

  const result = await page.evaluate(() => ({
    faces: window.__gravityDice.faces(),
    settled: window.__gravityDice.settled(),
    hudFaces: [...document.querySelectorAll(".face")].map((el) => Number(el.textContent)),
    resultText: document.querySelector("#result").innerText,
    telemetry: document.querySelector("#telemetry").innerText,
  }));
  console.log("result", JSON.stringify(result, null, 2));
  await page.screenshot({ path: "verify-settled.png" });

  const faces = result.faces;
  if (!faces.length || faces.some((n) => n < 1 || n > 6)) {
    throw new Error(`Invalid faces: ${faces}`);
  }
  console.log("VERIFY_OK");
} catch (err) {
  console.error("VERIFY_FAIL", err.message);
  await page.screenshot({ path: "verify-error.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (logs.length) {
    console.log("logs:");
    for (const line of logs.slice(-40)) console.log(line);
  }
  await browser.close();
}
