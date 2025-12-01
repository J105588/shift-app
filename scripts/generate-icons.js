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

  const sizes = [192, 512, 180]; // 180はiOS用のApple Touch Icon

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

  // iOS用のApple Touch Icon（180x180）を生成（既に上で生成済みだが、明示的にコピー）
  try {
    const appleTouchIconPath = path.join(outputDir, 'apple-touch-icon.png');
    if (!fs.existsSync(appleTouchIconPath)) {
      await sharp(svgPath)
        .resize(180, 180)
        .png()
        .toFile(appleTouchIconPath);
      console.log('✓ apple-touch-icon.png を生成しました（iOS用）');
    }
  } catch (error) {
    console.error('✗ apple-touch-icon.png の生成に失敗しました:', error);
  }

  // favicon.pngを生成
  try {
    await sharp(svgPath)
      .resize(32, 32)
      .png()
      .toFile(path.join(outputDir, 'favicon.png'));
    console.log('✓ favicon.png を生成しました');
  } catch (error) {
    console.error('✗ favicon.png の生成に失敗しました:', error);
  }

  // favicon.icoを生成（複数サイズを含むICO形式）
  try {
    // ICO形式は複雑なので、16x16, 32x32, 48x48のPNGを生成してからICOに変換
    const icoSizes = [16, 32, 48];
    const icoImages = [];
    
    for (const size of icoSizes) {
      const buffer = await sharp(svgPath)
        .resize(size, size)
        .png()
        .toBuffer();
      icoImages.push({ size, buffer });
    }
    
    // sharpはICO形式を直接サポートしていないため、32x32のPNGをfavicon.icoとしてコピー
    // 実際のICO形式が必要な場合は、別のライブラリ（例: to-ico）を使用
    await sharp(svgPath)
      .resize(32, 32)
      .png()
      .toFile(path.join(outputDir, 'favicon.ico'));
    console.log('✓ favicon.ico を生成しました（32x32 PNG形式）');
  } catch (error) {
    console.error('✗ favicon.ico の生成に失敗しました:', error);
  }
}

generateIcons();

