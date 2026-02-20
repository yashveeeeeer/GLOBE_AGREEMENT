import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const texturesDir = resolve(__dirname, "..", "public", "textures");
const dataDir = resolve(__dirname, "..", "public", "data");

mkdirSync(texturesDir, { recursive: true });
mkdirSync(dataDir, { recursive: true });

const textures: { url: string; filename: string; dir?: string }[] = [
  {
    url: "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg",
    filename: "earth-day.jpg",
  },
  {
    url: "https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png",
    filename: "earth-topology.png",
  },
  {
    url: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
    filename: "countries-110m.json",
    dir: "data",
  },
];

function download(url: string, dest: string): Promise<void> {
  return new Promise((res, rej) => {
    const follow = (u: string) => {
      https
        .get(u, (response) => {
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            follow(response.headers.location);
            return;
          }
          const chunks: Buffer[] = [];
          response.on("data", (c: Buffer) => chunks.push(c));
          response.on("end", () => {
            writeFileSync(dest, Buffer.concat(chunks));
            res();
          });
          response.on("error", rej);
        })
        .on("error", rej);
    };
    follow(url);
  });
}

async function main() {
  for (const { url, filename, dir } of textures) {
    const dest = resolve(dir === "data" ? dataDir : texturesDir, filename);
    if (existsSync(dest)) {
      console.log(`Already exists: ${filename}`);
      continue;
    }
    console.log(`Downloading ${filename}...`);
    await download(url, dest);
    console.log(`  Saved to ${dest}`);
  }
  console.log("Done.");
}

main().catch(console.error);
