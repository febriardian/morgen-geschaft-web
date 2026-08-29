import path from "node:path";
import { fileURLToPath } from "node:url";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: [
    tailwindcss({
      config: path.join(CONFIG_DIR, "tailwind.config.js"),
    }),
    autoprefixer(),
  ],
};
