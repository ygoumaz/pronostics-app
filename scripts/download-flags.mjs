/**
 * Downloads flag SVGs from flag-icons (jsDelivr CDN) into public/flags/.
 * Filenames use the FIFA/sport codes from data/teams.json (e.g. fra.svg).
 * Mapping: FIFA code → ISO 3166-1 alpha-2 (used by flag-icons).
 */

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "flags");

// FIFA code (lowercase) → ISO alpha-2 (lowercase)
const FIFA_TO_ISO = {
  mex: "mx",
  rsa: "za", // South Africa
  kor: "kr",
  cze: "cz",
  can: "ca",
  bih: "ba",
  qat: "qa",
  sui: "ch", // Switzerland
  bra: "br",
  mar: "ma",
  hai: "ht", // Haiti
  sco: "gb-sct", // Scotland (flag-icons uses gb-sct)
  usa: "us",
  par: "py", // Paraguay
  aus: "au",
  tur: "tr",
  ger: "de",
  cuw: "cw", // Curaçao
  civ: "ci",
  ecu: "ec",
  ned: "nl",
  jpn: "jp",
  swe: "se",
  tun: "tn",
  bel: "be",
  egy: "eg",
  irn: "ir",
  nzl: "nz",
  esp: "es",
  cpv: "cv", // Cape Verde
  ksa: "sa", // Saudi Arabia
  uru: "uy",
  fra: "fr",
  sen: "sn",
  irq: "iq",
  nor: "no",
  arg: "ar",
  alg: "dz", // Algeria
  aut: "at",
  jor: "jo",
  por: "pt",
  cod: "cd", // DR Congo
  uzb: "uz",
  col: "co",
  eng: "gb-eng", // England (flag-icons uses gb-eng)
  cro: "hr",
  gha: "gh",
  pan: "pa",
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
  });
}

// flag-icons SVG base URL on jsDelivr
const BASE = "https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3";

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const entries = Object.entries(FIFA_TO_ISO);
  let ok = 0;
  let fail = 0;

  for (const [fifa, iso] of entries) {
    const url = `${BASE}/${iso}.svg`;
    const dest = path.join(OUT_DIR, `${fifa}.svg`);
    try {
      await download(url, dest);
      console.log(`✓  ${fifa} (${iso})`);
      ok++;
    } catch (e) {
      console.error(`✗  ${fifa} (${iso}): ${e.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} downloaded, ${fail} failed.`);
}

main();
