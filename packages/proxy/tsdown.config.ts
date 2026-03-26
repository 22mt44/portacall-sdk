import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/adapters/express.ts"],
	format: ["esm", "cjs"],
});
