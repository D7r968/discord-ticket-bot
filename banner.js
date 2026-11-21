'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;
const IMAGES_DIR = path.join(config.ROOT, 'images');

function listImages() {
  try {
    return fs
      .readdirSync(IMAGES_DIR)
      .filter((file) => IMAGE_EXT.test(file))
      .sort((a, b) => {
        const rank = (name) => (/^banner/i.test(name) ? 0 : 1);
        return rank(a) - rank(b) || a.localeCompare(b);
      })
      .map((file) => path.join(IMAGES_DIR, file));
  } catch {
    return [];
  }
}

function getBannerPath() {
  const explicit = String(config.bannerFile || '').trim();
  if (explicit) {
    const full = path.isAbsolute(explicit) ? explicit : path.join(config.ROOT, explicit);
    if (fs.existsSync(full) && IMAGE_EXT.test(full)) return full;
  }
  return listImages()[0] || null;
}

function getBanner() {
  const file = getBannerPath();
  if (!file) return null;
  return { path: file, name: `banner${path.extname(file).toLowerCase()}` };
}

function describeBanner() {
  const file = getBannerPath();
  return file || 'ما فيه صورة — حط صورة داخل مجلد images (الأفضل اسمها banner.png)';
}

module.exports = { getBanner, describeBanner, listImages, IMAGES_DIR };
