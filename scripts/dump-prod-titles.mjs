const q = process.argv[2] ?? "Samsung S24";
const res = await fetch(`https://www.zorino.org/en/search?q=${encodeURIComponent(q)}`, {
  headers: { Cookie: "NEXT_LOCALE=en" },
});
const html = await res.text();
const titles = [...html.matchAll(/class="deal-name">([^<]+)/g)].map((m) =>
  m[1].replace(/&amp;/g, "&").trim()
);
console.log(`Query: ${q} — ${titles.length} results\n`);
titles.forEach((t, i) => console.log(`${i + 1}. ${t}`));
