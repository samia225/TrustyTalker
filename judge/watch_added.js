/* Watches for cases added in the TrustyTalker page and sends them to the AI judge automatically.
   Owner: Person 2. Node only, no packages. The page itself never calls the AI (it works offline).

   How it works:
   1. In the page, adding a case (or a JARA thumbs-down case) downloads
      trustytalker-added-cases.json into your Downloads folder.
   2. This script sees the file, works out which conversations are new or changed
      (by fingerprint), and judges only those with judge/run_judge.js --live --cases.
      Conversations are anonymized before they are sent, like every judge run.
   3. Results go to judge_added_results.js (local, gitignored). The open page re-reads
      that file every few seconds and shows the AI's opinion without a refresh.
   4. The downloaded file is deleted, so the next download keeps the same name.

   Run (leave it running in a terminal; Ctrl+C to stop):
     node judge/watch_added.js
     node judge/watch_added.js --dir "C:/Users/you/Downloads"     (another folder)
     node judge/watch_added.js --once                              (process what is there, then stop)
   Needs OPENAI_API_KEY in .env. Fictional data only. Each run is capped by JUDGE_MAX_TOTAL_TOKENS. */
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const judge = require("./run_judge.js");
const similarity = require("../engine/similarity.js");

const FILE_PATTERN = /^trustytalker-added-cases(?: ?\(\d+\))?\.json$/;

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
}

// Only cases with at least one conversation the AI has not seen in exactly this form.
function needsJudging(cases, previous) {
  const seen = new Map(((previous && previous.results) || []).map(r => [r.variant_id, r.fingerprint]));
  return cases.filter(c => Array.isArray(c.variants) && c.variants.some(v => seen.get(v.id) !== similarity.fingerprint(v.turns)));
}

// Wait until the browser has finished writing the file.
async function settled(file) {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    let size;
    try { size = fs.statSync(file).size; } catch (error) { return false; }
    if (size > 0 && size === last) return true;
    last = size;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

async function processFile(file, { fetchImpl, env, log = console.log } = {}) {
  if (!(await settled(file))) return { skipped: "file not ready" };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { log("Could not read " + path.basename(file) + ": " + error.message); return { skipped: "unreadable" }; }
  const cases = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.cases) ? parsed.cases : [];
  const todo = needsJudging(cases, judge.readAddedResults());
  if (!todo.length) {
    log("Nothing new in " + path.basename(file) + ": every conversation in it was already judged.");
    fs.rmSync(file, { force: true });
    return { judged: [] };
  }
  const tmp = path.join(os.tmpdir(), "trustytalker-to-judge-" + Date.now() + ".json");
  fs.writeFileSync(tmp, JSON.stringify({ cases: todo }));
  try {
    log("Sending " + todo.length + " added case(s) to the AI judge: " + todo.map(c => c.id).join(", ") + " ...");
    const options = {};
    if (fetchImpl) options.fetchImpl = fetchImpl;
    if (env) options.env = env;
    const { results } = await judge.runLive(["--live", "--cases", tmp], options);
    const run = results.runs[results.runs.length - 1];
    log("Done: " + run.variants.join(", ") + ". The page shows the AI's opinion within a few seconds.");
    fs.rmSync(file, { force: true });
    return { judged: run.variants };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

async function main(args) {
  const dir = path.resolve(argValue(args, "--dir") || path.join(os.homedir(), "Downloads"));
  if (!fs.existsSync(dir)) { console.error("Folder not found: " + dir + ". Use --dir to point at your downloads folder."); process.exitCode = 1; return; }
  const env = judge.readEnv();
  if (!env.OPENAI_API_KEY) { console.error("No OPENAI_API_KEY in .env, so the AI judge cannot run."); process.exitCode = 1; return; }

  let busy = false, again = false;
  async function sweep() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      const files = fs.readdirSync(dir).filter(n => FILE_PATTERN.test(n)).map(n => path.join(dir, n))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
      // The newest download holds every added case; older copies are processed in order and removed.
      for (const file of files) {
        try { await processFile(file); } catch (error) { console.log("AI judge run failed: " + error.message); }
      }
    } finally {
      busy = false;
      if (again) { again = false; sweep(); }
    }
  }

  console.log("Watching " + dir + " for trustytalker-added-cases.json. Add a case in TrustyTalker; Ctrl+C to stop.");
  await sweep();
  if (args.includes("--once")) return;
  let timer = null;
  fs.watch(dir, (event, name) => {
    if (!name || !FILE_PATTERN.test(String(name))) return;
    clearTimeout(timer);
    timer = setTimeout(sweep, 600);
  });
}

module.exports = { processFile, needsJudging, FILE_PATTERN };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
