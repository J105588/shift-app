// このスクリプトは、SVGアイコンからPNGアイコンを生成するためのものです
// 実行には sharp パッケージが必要です: npm install sharp --save-dev

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const svgPath = path.join(__dirname, '../public/icon.svg');
  const outputDir = path.join(__dirname, '../public');

  if (!fs.existsSync(svgPath)) {
    console.error('icon.svgが見つかりません');
    return;
  }

  const sizes = [192, 512];

  for (const size of sizes) {
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(path.join(outputDir, `icon-${size}x${size}.png`));
      console.log(`✓ icon-${size}x${size}.png を生成しました`);
    } catch (error) {
      console.error(`✗ icon-${size}x${size}.png の生成に失敗しました:`, error);
    }
  }

  // favicon.icoも生成
  try {
    await sharp(svgPath)
      .resize(32, 32)
      .png()
      .toFile(path.join(outputDir, 'favicon.png'));
    console.log('✓ favicon.png を生成しました');
  } catch (error) {
    console.error('✗ favicon.png の生成に失敗しました:', error);
  }
}

generateIcons();

