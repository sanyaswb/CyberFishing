// convert-images.js v1.3.0

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

const BASE_DIR = __dirname;
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

async function convertImages(quality, formatChoice, addSuffix) {
  const { webp: webpQuality, avif: avifQuality } = quality;
  const qualitySuffix = addSuffix ? `--${quality.name.toLowerCase()}` : '';

  console.log('Starting image search...');

  const pattern = path.join(BASE_DIR, '**', '*.{png,jpg,jpeg}');
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

main();
