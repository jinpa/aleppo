import { BG } from "bgutils-js";
import type { BgConfig } from "bgutils-js";
import { JSDOM } from "jsdom";
import { Innertube } from "youtubei.js";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cached: {
  poToken: string;
  visitorData: string;
  generatedAt: number;
} | null = null;

/**
 * Generate a YouTube Proof-of-Origin token using bgutils-js.
 * Tokens are cached for 6 hours. Returns null if generation fails
 * (caller should proceed without a token).
 */
export async function getYouTubePoToken(): Promise<{
  poToken: string;
  visitorData: string;
} | null> {
  if (process.env.YOUTUBE_PO_TOKEN !== "true") {
    return null;
  }

  // Return cached token if still valid
  if (cached && Date.now() - cached.generatedAt < CACHE_TTL_MS) {
    return { poToken: cached.poToken, visitorData: cached.visitorData };
  }

  try {
    console.log("[youtube-po-token] Generating new PO token...");
    const startTime = Date.now();

    // 1. Get visitorData from YouTube
    const innertube = await Innertube.create({ retrieve_player: false });
    const visitorData = innertube.session.context.client.visitorData;
    if (!visitorData) {
      console.error("[youtube-po-token] Could not get visitor data");
      return null;
    }

    // 2. Set up JSDOM for BotGuard VM
    const dom = new JSDOM();
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
    });

    // 3. Create BotGuard challenge
    const requestKey = "O43z0dpjhgX20SCx4KAo";
    const bgConfig: BgConfig = {
      fetch: (input: string | URL | globalThis.Request, init?: RequestInit) =>
        fetch(input, init),
      globalObj: globalThis,
      identifier: visitorData,
      requestKey,
    };

    const bgChallenge = await BG.Challenge.create(bgConfig);
    if (!bgChallenge) {
      console.error("[youtube-po-token] Could not get BotGuard challenge");
      return null;
    }

    // 4. Execute the interpreter JS
    const interpreterJs =
      bgChallenge.interpreterJavascript
        .privateDoNotAccessOrElseSafeScriptWrappedValue;
    if (!interpreterJs) {
      console.error("[youtube-po-token] No interpreter JavaScript in challenge");
      return null;
    }
    new Function(interpreterJs)();

    // 5. Generate PO token
    const result = await BG.PoToken.generate({
      program: bgChallenge.program,
      globalName: bgChallenge.globalName,
      bgConfig,
    });

    const elapsed = Date.now() - startTime;
    console.log(
      `[youtube-po-token] Generated PO token in ${elapsed}ms, TTL: ${result.integrityTokenData.estimatedTtlSecs}s`
    );

    // 6. Cache and return
    cached = {
      poToken: result.poToken,
      visitorData,
      generatedAt: Date.now(),
    };

    return { poToken: result.poToken, visitorData };
  } catch (err) {
    console.error(
      "[youtube-po-token] Failed to generate PO token:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
