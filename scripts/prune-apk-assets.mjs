// Перед збіркою Android-застосунку прибирає з out/web деталізовані тайли (tiles-hd): вони лише для сайту й зробили б APK завеликим.
import { rmSync } from "node:fs";
rmSync(new URL("../out/web/tiles-hd", import.meta.url), { recursive: true, force: true });
console.log("tiles-hd прибрано з out/web");
