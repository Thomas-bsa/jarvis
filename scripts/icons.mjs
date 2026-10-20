// Generates the app icons (run: node scripts/icons.mjs)
import sharp from "sharp";
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#05080D"/>
<circle cx="256" cy="256" r="196" fill="none" stroke="#5CE1FF" stroke-opacity=".25" stroke-width="3" stroke-dasharray="3 18"/>
<circle cx="256" cy="256" r="160" fill="none" stroke="#5CE1FF" stroke-opacity=".6" stroke-width="8" stroke-dasharray="150 50 20 50"/>
<circle cx="256" cy="256" r="118" fill="none" stroke="#5CE1FF" stroke-opacity=".35" stroke-width="22" stroke-dasharray="10 14"/>
<circle cx="256" cy="256" r="70" fill="#0B1A24" stroke="#5CE1FF" stroke-width="10"/>
<circle cx="256" cy="256" r="40" fill="#5CE1FF" fill-opacity=".18"/>
</svg>`;
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(`public/${name}`);
}
console.log("icons ok");
