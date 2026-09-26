import type { ForgeConfig } from "@electron-forge/shared-types"
import { VitePlugin } from "@electron-forge/plugin-vite"

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: "assets/icon.icns",
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-zip",
      config: {},
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {},
    },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/index.ts",
          config: "vite.main.config.mts",
          target: "main",
        },
        {
          entry: "src/preload/index.ts",
          config: "vite.preload.config.mts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),
  ],
}

export default config