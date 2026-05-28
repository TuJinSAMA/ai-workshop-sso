import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(process.cwd(), "src");

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walkTsx(path, out);
    } else if (name.endsWith(".tsx")) {
      out.push(path);
    }
  }
  return out;
}

/** Extract each `<form ...>` opening tag, including multiline attributes. */
function extractFormOpenTags(source: string): string[] {
  const tags: string[] = [];
  let i = 0;
  while (i < source.length) {
    const start = source.indexOf("<form", i);
    if (start === -1) break;
    let end = start + 5;
    while (end < source.length && source[end] !== ">") end += 1;
    if (end < source.length) tags.push(source.slice(start, end + 1));
    i = end + 1;
  }
  return tags;
}

describe("HTML forms in src/", () => {
  it("every <form> declares method=\"POST\" (no GET credential leaks)", () => {
    const violations: string[] = [];

    for (const file of walkTsx(SRC_ROOT)) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("<form")) continue;

      for (const tag of extractFormOpenTags(source)) {
        if (!/method\s*=\s*["']POST["']/i.test(tag)) {
          violations.push(`${file.replace(SRC_ROOT + "/", "src/")}: ${tag.replace(/\s+/g, " ").slice(0, 120)}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
