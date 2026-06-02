const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const readline = require("readline");
const { spawn } = require("child_process");

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

function listInterfaces() {
  const net = os.networkInterfaces();
  const result = [];
  Object.keys(net).forEach((name) => {
    net[name].forEach((iface) => {
      if (iface.family === "IPv4" && !iface.internal) {
        result.push({ name, address: iface.address });
      }
    });
  });
  return result;
}

function tryPrintQRCode(url) {
  try {
    const qrcode = require("qrcode-terminal");
    qrcode.generate(url, { small: true });
  } catch {
    console.log(
      "(QR-код не показано — встановіть 'npm i qrcode-terminal' для відображення)"
    );
  }
}

function contentTypeByExt(ext) {
  const map = {
    ".html": "text/html",
    ".htm": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

function detectCandidateDirs(rootDir) {
  const candidates = [];
  const names = ["public", "dist", "build", "www", "out", "app"];
  for (const name of names) {
    const dir = path.join(rootDir, name);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      candidates.push(dir);
    }
  }
  const indexInRoot = path.join(rootDir, "index.html");
  if (fs.existsSync(indexInRoot)) candidates.push(rootDir);
  return candidates;
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === "win32") cmd = "start";
  else if (platform === "darwin") cmd = "open";
  else cmd = "xdg-open";
  spawn(cmd, [url], { shell: true, stdio: "ignore", detached: true }).unref();
}

async function main() {
  console.log("=== UNIVERSAL LOCAL SERVER ===\n");

  const rootDir = process.cwd();
  console.log("Поточна директорія:", rootDir);

  let dirs = detectCandidateDirs(rootDir);

  if (dirs.length === 0) {
    console.log("\n❗ Не знайдено типових тек (public, dist, build...).");
    console.log("Вкажіть шлях вручну, наприклад: ./public або ./dist");
    const manual = await ask("Введіть шлях для сервера: ");
    if (manual && fs.existsSync(manual)) dirs = [path.resolve(manual)];
    else {
      console.error("Невірний шлях. Вихід.");
      process.exit(1);
    }
  }

  console.log("\nМожливі шляхи до проекту:");
  dirs.forEach((d, i) => console.log(`  ${i + 1}) ${d}`));
  const choice = await ask(
    "\nСкопіюйте шлях і вставте його сюди або введіть номер: "
  );
  let chosenPath;
  if (Number.isInteger(parseInt(choice))) {
    const idx = parseInt(choice) - 1;
    chosenPath = dirs[idx];
  } else {
    chosenPath = path.resolve(choice.trim());
  }

  if (!chosenPath || !fs.existsSync(chosenPath)) {
    console.error("❌ Шлях не знайдено:", chosenPath);
    process.exit(1);
  }

  console.log("\n✅ Обрано шлях:", chosenPath);

  const interfaces = listInterfaces();
  if (!interfaces.length) {
    console.error("Не знайдено зовнішніх мережевих інтерфейсів (IPv4).");
    process.exit(1);
  }

  console.log("\nЗнайдені мережеві інтерфейси:");
  interfaces.forEach((it, i) => {
    console.log(`  ${i + 1}) ${it.name} — ${it.address}`);
  });

  const ans = await ask("\nОберіть інтерфейс (номер): ");
  const idx = parseInt(ans.trim(), 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= interfaces.length) {
    console.error("Невірний номер. Вихід.");
    process.exit(1);
  }
  const chosenIface = interfaces[idx];

  const portAns = await ask("\nПорт для сервера (Enter для 3000): ");
  const port =
    portAns.trim() === "" ? 3000 : parseInt(portAns.trim(), 10) || 3000;

  console.log("\nГотово до запуску сервера.");
  await ask("Натисніть Enter, щоб запустити сервер...");

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    let filePath = path.join(chosenPath, urlPath);
    if (filePath.endsWith(path.sep))
      filePath = path.join(filePath, "index.html");
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      const indexHtml = path.join(chosenPath, "index.html");
      if (fs.existsSync(indexHtml)) {
        const data = fs.readFileSync(indexHtml);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(filePath);
    const ct = contentTypeByExt(ext);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("500 Internal Server Error");
        return;
      }
      res.writeHead(200, { "Content-Type": ct });
      res.end(data);
    });
  });

  server.on("error", (err) => {
    console.error("Server error:", err.message);
    process.exit(1);
  });

  server.listen(port, chosenIface.address, () => {
    const url = `http://${chosenIface.address}:${port}/`;
    console.log(`\n🚀 Сервер запущено за адресою: ${url}`);
    console.log(`Сервована папка: ${chosenPath}`);
    console.log("\n📱 QR для підключення (опціонально):");
    tryPrintQRCode(url);
    console.log("\nВідкриваю браузер...");
    openBrowser(url);
    console.log("\n(Натисніть Ctrl+C, щоб зупинити сервер)");
  });
}

main();
