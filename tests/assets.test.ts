import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("all player avatars resolve within the standalone Link public directory", () => {
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, "public/data/players.json"), "utf8")) as {
    players: Array<{ avatar: string }>;
  };
  for (const player of snapshot.players) {
    if (!player.avatar) continue;
    assert.match(player.avatar, /^\.\/assets\/player-icons\/[a-f0-9]+\.webp$/);
    assert.ok(fs.statSync(path.join(root, "public", player.avatar)).isFile(), player.avatar);
  }
});
