#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const DAY_MS = 86_400_000;

function render(data) {
  if (!Array.isArray(data) || data.length < 31) {
    throw new Error("Expected at least 31 contribution days");
  }
  const days = data.map((item) => {
    if (!item || typeof item.date !== "string") {
      throw new Error("Invalid contribution day");
    }
    const { date, contributionCount: count } = item;
    const time = Date.parse(date);
    if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time)
      || new Date(time).toISOString().slice(0, 10) !== date
      || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("Invalid contribution date or count");
    }
    return { date, count, time };
  }).sort((a, b) => a.time - b.time);
  if (new Set(days.map((day) => day.date)).size !== days.length) {
    throw new Error("Duplicate contribution dates");
  }
  const recent = days.slice(-31);
  const start = recent[0].date;
  const end = recent.at(-1).date;
  if (recent.at(-1).time - recent[0].time !== 30 * DAY_MS) {
    throw new Error("Contribution days must be consecutive");
  }

  const ceiling = Math.max(4, Math.ceil(Math.max(...recent.map((day) => day.count)) / 4) * 4);
  const points = recent.map((day, index) => ({
    x: 70 + index * 1060 / 30,
    y: 240 - day.count / ceiling * 160,
  }));
  const total = recent.reduce((sum, day) => sum + day.count, 0);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="330" viewBox="0 0 1200 330" role="img" aria-labelledby="title description">',
    "<title id=\"title\">AQian0's GitHub activity</title>",
    `<desc id="description">${total} contributions from ${start} to ${end}. Daily counts: ${recent.map((day) => `${day.date}: ${day.count}`).join(", ")}.</desc>`,
    '<rect x="0.5" y="0.5" width="1199" height="329" rx="6" fill="#2c3e50" stroke="#ffffff"/>',
    '<g font-family="Arial, sans-serif" font-size="13" fill="#41b883">',
    "<text x=\"600\" y=\"34\" text-anchor=\"middle\" font-size=\"22\" font-weight=\"bold\">AQian0's GitHub activity</text>",
    `<text x="600" y="56" text-anchor="middle">${start} — ${end}</text>`,
    '<text x="20" y="160" text-anchor="middle" transform="rotate(-90 20 160)">Contributions</text>',
    '<text x="600" y="304" text-anchor="middle">Date</text>',
  ];
  for (let index = 0; index < 5; index++) {
    const y = 240 - index * 40;
    svg.push(`<path d="M70 ${y}H1130" stroke="#ffffff" stroke-opacity="0.15"/>`);
    svg.push(`<text x="58" y="${y + 4}" text-anchor="end">${ceiling * index / 4}</text>`);
  }
  for (let index = 0; index < 31; index += 5) {
    svg.push(`<text x="${points[index].x.toFixed(2)}" y="266" text-anchor="middle">${recent[index].date.slice(5)}</text>`);
  }
  const coordinates = points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  svg.push(`<polyline points="${coordinates}" fill="none" stroke="#41b883" stroke-width="2"/>`);
  for (const [index, { x, y }] of points.entries()) {
    const { date, count } = recent[index];
    svg.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="#f6f8fa"><title>${date}: ${count} contributions</title></circle>`);
  }
  return [...svg, "</g></svg>"].join("\n");
}

function selfTest() {
  const data = Array.from({ length: 31 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, 1) + index * DAY_MS).toISOString().slice(0, 10),
    contributionCount: 0,
  }));
  assert.equal((render(data).match(/<circle /g) ?? []).length, 31);
  assert.equal((render(data).match(/cy="240\.00"/g) ?? []).length, 31);
  const peak = data.map((day, index) => ({ ...day, contributionCount: index === 30 ? 8 : 0 }));
  assert.match(render(peak.toReversed()), /cx="1130\.00" cy="80\.00"/);
  const older = { date: "2025-12-31", contributionCount: 100 };
  assert.equal(render([older, ...data]), render(data));
  for (const invalid of [
    null, [], data.slice(1), [...data, data[0]],
    [...data.slice(0, -1), { date: "2026-02-02", contributionCount: 0 }],
    ...["2026-02-30", "2026-1-31", "0000-01-01", "invalid"].map((date) => [
      ...data.slice(0, -1), { date, contributionCount: 0 },
    ]),
    ...[-1, true, "2", null, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map((count) => [
      ...data.slice(0, -1), { date: "2026-01-31", contributionCount: count },
    ]),
  ]) {
    assert.throws(() => render(invalid));
  }
  console.error("Activity SVG self-test passed");
}

try {
  if (process.argv.length === 3 && process.argv[2] === "--self-test") {
    selfTest();
  } else {
    console.log(render(JSON.parse(readFileSync(0, "utf8"))));
  }
} catch (error) {
  console.error(`Cannot render activity graph: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
