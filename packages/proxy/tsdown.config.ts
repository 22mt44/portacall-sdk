import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/hono.ts", "src/express.ts"],
	format: ["esm", "cjs"],
});
