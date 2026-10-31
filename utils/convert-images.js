// convert-images.js v1.6.0

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const sharp = require('sharp');
const readline = require('readline');

const QUALITY_PRESETS = {
  1: { name: 'Low', webp: 50, avif: 40 },
  2: { name: 'Middle', webp: 80, avif: 65 },
  3: { name: 'High', webp: 95, avif: 85 },
};

const BASE_DIR = path.resolve(__dirname, '..');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const successfullyConvertedFiles = [];
const originalExtensions = new Set();

// --- Допоміжні функції ---

function askYesNo(question) {
  return new Promise((resolve) => {
    const ask = () => {
      rl.question(`\n${question} (1 так/ 2 ні): `, (answer) => {
        const ans = answer.trim().toLowerCase();
        if (ans === 'так' || ans === 'т' || ans === '1') {
          resolve(true);
        } else if (ans === 'ні' || ans === 'н' || ans === '2') {
          resolve(false);
        } else {
          console.log("❌ Будь ласка, введіть '1 так' або '2 ні'.");
          ask();
        }
      });
    };
    ask();
  });
}

// Функція для вибору якості 1-10 (для перетискання)
function askRecompressQuality() {
  return new Promise((resolve) => {
    const ask = () => {
      console.log('\n╔══════════════════════════════════════╗');
      console.log('║   Оберіть рівень якості (1-10):      ║');
      console.log('╟──────────────────────────────────────╢');
      console.log('║ 1  = Максимальне стиснення (Low)     ║');
      console.log('║ 5  = Баланс (Medium)                 ║');
      console.log('║ 10 = Майже без змін (High)           ║');
      console.log('╚══════════════════════════════════════╝');

      rl.question('Ваш вибір (1-10): ', (answer) => {
        const level = parseInt(answer.trim(), 10);
        if (Number.isInteger(level) && level >= 1 && level <= 10) {
          resolve(level);
        } else {
          console.log(
            '❌ Невірний вибір. Будь ласка, введіть число від 1 до 10.\n',
          );
          ask();
        }
      });
    };
    ask();
  });
}

// Визначає суфікс на основі цифри 1-10
function getSuffixByQuality(level) {
  if (level <= 3) return '--low';
  if (level <= 7) return '--medium';
  return '--high';
}

// Функція вибору пресетів (для основної конвертації)
function askForQuality() {
  return new Promise((resolve) => {
    const ask = () => {
      console.log('\n╔══════════════════════════════════════╗');
      console.log('║   Оберіть якість конвертації:        ║');
      console.log('╟──────────────────────────────────────╢');
      console.log('║ 1. Low    (Найменший розмір)         ║');
      console.log('║ 2. Middle (Баланс розміру/якості)    ║');
      console.log('║ 3. High   (Найкраща якість)          ║');
      console.log('╚══════════════════════════════════════╝');

      rl.question('Ваш вибір (1, 2 або 3): ', (answer) => {
        const choice = answer.trim();
        const selected = QUALITY_PRESETS[choice];
        if (selected) {
          resolve(selected);
        } else {
          console.log('❌ Невірний вибір. Будь ласка, введіть 1, 2 або 3.\n');
          ask();
        }
      });
    };
    ask();
  });
}

function askForFormat() {
  return new Promise((resolve) => {
    const ask = () => {
      console.log('\n╔══════════════════════════════════════╗');
      console.log('║   Оберіть кінцевий формат(и):        ║');
      console.log('╟──────────────────────────────────────╢');
      console.log('║ 1. Тільки .webp                      ║');
      console.log('║ 2. Тільки .avif                      ║');
      console.log('║ 3. .webp та .avif (Обидва)           ║');
      console.log('╚══════════════════════════════════════╝');

      rl.question('Ваш вибір (1, 2 або 3): ', (answer) => {
        const choice = answer.trim();
        if (['1', '2', '3'].includes(choice)) {
          resolve(choice);
        } else {
          console.log('❌ Невірний вибір. Будь ласка, введіть 1, 2 або 3.\n');
          ask();
        }
      });
    };
    ask();
  });
}

// --- Основна логіка ---

async function convertImages(quality, formatChoice, addSuffix, rootDir = BASE_DIR) {
  const { webp: webpQuality, avif: avifQuality } = quality;
  const qualitySuffix = addSuffix ? `--${quality.name.toLowerCase()}` : '';

  console.log('Starting image search...');

  const pattern = path.join(rootDir, '**', '*.{png,jpg,jpeg}');
  const globPattern = pattern.replace(/\\/g, '/');
  console.log(`Searching with glob pattern: ${globPattern}`);

  const files = glob.sync(globPattern, {
    ignore: '**/node_modules/**',
  });

  if (files.length === 0) {
    console.log('No .png, .jpg, or .jpeg files found (outside node_modules).');
    return;
  }

  console.log(`Found ${files.length} images. Starting conversion...`);

  for (const imgPath of files) {
    try {
      const parsedPath = path.parse(imgPath);
      const outputDir = parsedPath.dir;
      const originalName = parsedPath.name;
      const originalExt = parsedPath.ext.substring(1);

      const hasPng = fs.existsSync(path.join(outputDir, `${originalName}.png`));
      const hasJpg = fs.existsSync(path.join(outputDir, `${originalName}.jpg`));
      const hasJpeg = fs.existsSync(
        path.join(outputDir, `${originalName}.jpeg`),
      );

      const competitors = [hasPng, hasJpg, hasJpeg].filter(Boolean).length;

      let outputName;

      // Якщо є конфлікти імен, додаємо старе розширення в назву
      if (competitors > 1) {
        outputName = `${originalName}-${originalExt}${qualitySuffix}`;
      } else {
        outputName = `${originalName}${qualitySuffix}`;
      }

      const image = sharp(imgPath);
      let convertedFormats = [];

      if (formatChoice === '1' || formatChoice === '3') {
        const webpPath = path.join(outputDir, `${outputName}.webp`);
        await image.webp({ quality: webpQuality }).toFile(webpPath);
        convertedFormats.push('.webp');
      }

      if (formatChoice === '2' || formatChoice === '3') {
        const avifPath = path.join(outputDir, `${outputName}.avif`);
        await image.avif({ quality: avifQuality, effort: 5 }).toFile(avifPath);
        convertedFormats.push('.avif');
      }

      if (convertedFormats.length > 0) {
        successfullyConvertedFiles.push(imgPath);
        originalExtensions.add(parsedPath.ext);
      }

      console.log(
        `✅ Converted: ${parsedPath.base} -> ${outputName}${convertedFormats.join(', ')}`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to convert ${path.basename(imgPath)}:`,
        error.message,
      );
    }
  }

  console.log('\nImage conversion complete! ✨');
}

async function offerRecompression() {
  console.log('\n--- Додаткова оптимізація .webp ---');

  const globPattern = path
    .join(BASE_DIR, '**', 'webp--low', '**', '*.webp')
    .replace(/\\/g, '/');

  console.log(
    `Searching for re-compression targets with glob pattern: ${globPattern}`,
  );

  const files = glob.sync(globPattern, {
    ignore: '**/node_modules/**',
  });

  if (files.length === 0) {
    console.log(
      "! Папок 'webp--low', що містять .webp файли, не знайдено. Пропускаємо.",
    );
    return;
  }

  console.log(`🔔 Знайдено ${files.length} .webp файлів у папках "webp--low".`);

  const shouldRecompress = await askYesNo(
    'Бажаєте змінити їх якість (перетиснути)?',
  );

  if (!shouldRecompress) {
    console.log('Пропускаємо погіршення якості.');
    return;
  }

  // 1. Обираємо рівень 1-10
  const qualityLevel = await askRecompressQuality();
  const sharpQuality = qualityLevel * 10; // 1 -> 10, 5 -> 50, 10 -> 100

  // 2. Визначаємо, який буде суфікс
  const suffixName = getSuffixByQuality(qualityLevel);

  // 3. Запитуємо користувача про метод збереження
  const addSuffix = await askYesNo(
    `Додати суфікс ${suffixName} до нових файлів? (Якщо НІ - оригінали буде перезаписано)`,
  );

  console.log(
    `🔥 Обробка з рівнем ${qualityLevel}/10 (Sharp: ${sharpQuality})...`,
  );
  if (!addSuffix) {
    console.log('⚠️  УВАГА: Файли будуть перезаписані без зміни назви!');
  }

  for (const imgPath of files) {
    try {
      const parsedPath = path.parse(imgPath);

      if (addSuffix) {
        // --- ВАРІАНТ 1: Створення копії (БЕЗ ДУЖОК) ---

        let newNameBase = parsedPath.name;

        // Захист від дублювання суфіксів (image--low--low.webp)
        if (newNameBase.endsWith(suffixName)) {
          console.log(
            `ℹ️ Файл ${parsedPath.base} вже має суфікс ${suffixName}. Оновлюємо вміст...`,
          );
          const tempPath = path.join(
            parsedPath.dir,
            `temp_${Date.now()}_${parsedPath.base}`,
          );
          await sharp(imgPath).webp({ quality: sharpQuality }).toFile(tempPath);
          fs.unlinkSync(imgPath);
          fs.renameSync(tempPath, imgPath);
          console.log(`✅ Оновлено: ${parsedPath.base}`);
          continue;
        }

        // Формуємо нове ім'я: image--low.webp
        const newFilename = `${newNameBase}${suffixName}${parsedPath.ext}`;
        const newPath = path.join(parsedPath.dir, newFilename);

        await sharp(imgPath).webp({ quality: sharpQuality }).toFile(newPath);

        console.log(`✅ Копія: ${parsedPath.base} -> ${newFilename}`);
      } else {
        // --- ВАРІАНТ 2: Перезапис (Overwrite) ---
        const tempPath = path.join(
          parsedPath.dir,
          `temp_${Date.now()}_${parsedPath.base}`,
        );

        await sharp(imgPath).webp({ quality: sharpQuality }).toFile(tempPath);

        // Видаляємо старий файл і перейменовуємо новий
        fs.unlinkSync(imgPath);
        fs.renameSync(tempPath, imgPath);

        console.log(`✅ Перезаписано: ${parsedPath.base}`);
      }
    } catch (error) {
      console.error(
        `❌ Помилка при обробці ${path.basename(imgPath)}:`,
        error.message,
      );
    }
  }
  console.log('\nОптимізацію завершено! ✨');
}

async function offerToManageOriginals() {
  console.log('\n--- Керування оригінальними файлами ---');

  const extString = Array.from(originalExtensions).join(', ');
  const shouldManage = await askYesNo(
    `Бажаєте видалити оригінали (${extString})?`,
  );

  if (!shouldManage) {
    console.log('Оригінали залишено на місці.');
    return;
  }

  const shouldBackup = await askYesNo(
    'Створити папку з всіма оригіналами в корні проекту? (Безпечне переміщення)',
  );

  if (shouldBackup) {
    await backupOriginals();
  } else {
    console.log('\nДію скасовано. Оригінали залишено на місці.');
    return;
  }
}

async function backupOriginals() {
  const backupDirName = '_originals_backup';
  const backupDir = path.join(BASE_DIR, backupDirName);

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
  } catch (err) {
    console.error(`❌ Не вдалося створити папку бекапу: ${err.message}`);
    console.log('Переміщення файлів скасовано.');
    return;
  }

  console.log(
    `\n📦 Переміщую ${successfullyConvertedFiles.length} файлів у ${backupDirName}...`,
  );
  let successCount = 0;
  let conflictCount = 0;

  for (const oldPath of successfullyConvertedFiles) {
    const fileName = path.basename(oldPath);
    let newPath = path.join(backupDir, fileName);

    try {
      if (fs.existsSync(newPath)) {
        const parsed = path.parse(fileName);
        let counter = 1;
        let conflictName;
        do {
          conflictName = `${parsed.name}_(${counter})${parsed.ext}`;
          newPath = path.join(backupDir, conflictName);
          counter++;
        } while (fs.existsSync(newPath));
        console.log(
          `  ⚠️  Конфлікт: ${fileName} буде перейменовано на ${conflictName}`,
        );
        conflictCount++;
      }

      fs.renameSync(oldPath, newPath);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Не вдалося перемістити ${fileName}: ${err.message}`);
    }
  }

  console.log(`\n✅ Успішно переміщено ${successCount} файлів.`);
  if (conflictCount > 0) {
    console.log(
      `   (З них ${conflictCount} було перейменовано через конфлікти).`,
    );
  }
  console.log(`   Шлях до папки: ${backupDir}`);
}

async function main() {
  try {
    await offerRecompression();

    console.log('\n--- Основна конвертація (PNG/JPG) ---');

    const quality = await askForQuality();
    const formatChoice = await askForFormat();

    // Запитання про суфікс для основної конвертації
    const addSuffix = await askYesNo(
      `Додавати суфікс якості до назви? (наприклад: --${quality.name.toLowerCase()})`,
    );

    const formatNames = { 1: '.webp', 2: '.avif', 3: '.webp & .avif' };

    console.log(`\n🔥 Запуск конвертації...`);
    console.log(
      `   - Якість: ${quality.name} (WebP: ${quality.webp}, AVIF: ${quality.avif})`,
    );

    console.log(`   - Формати: ${formatNames[formatChoice]}`);
    console.log(`   - Суфікс у назві: ${addSuffix ? 'Так' : 'Ні'}`);

    await convertImages(quality, formatChoice, addSuffix);

    if (successfullyConvertedFiles.length > 0) {
      await offerToManageOriginals();
    } else {
      console.log(
        '\nКонвертацію завершено. Не знайдено файлів для переміщення.',
      );
    }
  } catch (err) {
    console.error('An unexpected error occurred:', err);
  } finally {
    rl.close();
  }
}

// --top-fraction 0.3 keeps the upper 30% before the ordinary contain resize (full image by default).
// node utils/convert-images.js --thumbnails --input <masters> --output <assets> [--size 128..2048]
//   [--quality low|middle|high]  (spec 157 R5/R6: display-sized art with the --batch presets; middle = WebP 80)
async function createThumbnails(args) {
  const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index < 0 ? fallback : args[index + 1];
  };
  const input = path.resolve(BASE_DIR, option('--input', 'assets/fish'));
  const output = path.resolve(BASE_DIR, option('--output', 'assets/fish-thumbnails'));
  const size = Number(option('--size', '128'));
  const topFraction = Number(option('--top-fraction', '1'));
  const qualityKeys = { low: '1', middle: '2', medium: '2', high: '3' };
  const quality = QUALITY_PRESETS[qualityKeys[option('--quality', 'middle')]];
  if (!quality || !Number.isSafeInteger(size) || size < 1 || size > 2048 || input === output ||
    !Number.isFinite(topFraction) || topFraction <= 0 || topFraction > 1 ||
    path.relative(BASE_DIR, output).startsWith('..')) throw new Error('Invalid thumbnail options');
  const files = glob.sync('**/*.{png,jpg,jpeg,webp,avif}', { cwd: input, nodir: true });
  for (const relative of files) {
    const source = path.join(input, relative);
    const target = path.join(output, relative.replace(/\.[^.]+$/, '.webp'));
    if (source === target) throw new Error('Thumbnail must not overwrite source');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const pipeline = sharp(source);
    if (topFraction < 1) {
      const metadata = await pipeline.metadata();
      pipeline.extract({ left: 0, top: 0, width: metadata.width,
        height: Math.max(1, Math.floor(metadata.height * topFraction)) });
    }
    await pipeline.resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: quality.webp }).toFile(target);
  }
  console.log(`Created ${files.length} thumbnails at max ${size}px, ${quality.name} (WebP ${quality.webp}) in ${
    path.relative(BASE_DIR, output)}`);
}

// Non-interactive conversion (spec 082): the same presets and naming as the dialogue, limited to one folder.
// node utils/convert-images.js --batch [--quality low|middle|high] [--format webp|avif|both] [--input assets]
// Originals stay in place; the caller updates references and removes them (Git keeps their history).
async function convertBatch(args) {
  const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index < 0 ? fallback : args[index + 1];
  };
  const qualityKeys = { low: '1', middle: '2', medium: '2', high: '3' };
  const formatKeys = { webp: '1', avif: '2', both: '3' };
  const quality = QUALITY_PRESETS[qualityKeys[option('--quality', 'middle')]];
  const formatChoice = formatKeys[option('--format', 'webp')];
  const input = path.resolve(BASE_DIR, option('--input', 'assets'));
  if (!quality || !formatChoice || path.relative(BASE_DIR, input).startsWith('..')) {
    throw new Error('Invalid batch options');
  }
  console.log(`Batch: ${quality.name} (WebP ${quality.webp}, AVIF ${quality.avif}) in ${path.relative(BASE_DIR, input)}`);
  await convertImages(quality, formatChoice, false, input);
  if (successfullyConvertedFiles.length === 0) process.exitCode = 1;
}

// Low-quality copies for progressive loading (spec 157 R17, TK-179), called by npm run assets:sync:
// node utils/convert-images.js --low-copies --manifest <json: [{ input, output }]>
// The longest side becomes a quarter of the original's, at most 256 px (never enlarged), the same proportion, WebP Low.
const LOW_COPY_MAX_SIDE = 256;
async function createLowCopies(args) {
  const index = args.indexOf('--manifest');
  const manifest = JSON.parse(fs.readFileSync(path.resolve(BASE_DIR, args[index + 1]), 'utf8'));
  for (const { input, output } of manifest) {
    const source = path.resolve(BASE_DIR, input);
    const target = path.resolve(BASE_DIR, output);
    if (source === target || path.relative(BASE_DIR, target).startsWith('..')) throw new Error(`Invalid low copy ${output}`);
    const { width, height } = await sharp(source).metadata();
    const side = Math.max(1, Math.min(LOW_COPY_MAX_SIDE, Math.round(Math.max(width, height) / 4)));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await sharp(source).resize(side, side, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY_PRESETS[1].webp }).toFile(target);
  }
  console.log(`Created ${manifest.length} low copies (max ${LOW_COPY_MAX_SIDE} px, WebP ${QUALITY_PRESETS[1].webp}).`);
}

if (process.argv.includes('--low-copies')) {
  createLowCopies(process.argv.slice(2)).catch((error) => {
    console.error(error.message); process.exitCode = 1;
  }).finally(() => rl.close());
} else if (process.argv.includes('--batch')) {
  convertBatch(process.argv.slice(2)).catch((error) => {
    console.error(error.message); process.exitCode = 1;
  }).finally(() => rl.close());
} else if (process.argv.includes('--thumbnails')) {
  createThumbnails(process.argv.slice(2)).catch((error) => {
    console.error(error.message); process.exitCode = 1;
  }).finally(() => rl.close());
} else main();
