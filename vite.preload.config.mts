import { defineConfig, type Plugin } from "vite"

function useModernPreloadOutput(): Plugin {
	return {
		name: "modern-preload-output",
		configResolved(config) {
			const configuredOutput = config.build.rollupOptions.output
			const outputs = Array.isArray(configuredOutput) ? configuredOutput : [configuredOutput]
			for (const output of outputs) {
				if (!output) continue
				delete output.inlineDynamicImports
				Object.assign(output, { codeSplitting: false })
			}
		},
	}
}

export default defineConfig({
	build: {
		rollupOptions: {
			output: {
				entryFileNames: "preload.js",
			},
		},
	},
	plugins: [useModernPreloadOutput()],
})