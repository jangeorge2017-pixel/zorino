import sharp from "sharp";

const REF = "public/reference/zorino-final-design.png";

function dist(r, g, b, tr, tg, tb) {
  return Math.abs(r - tr) + Math.abs(g - tg) + Math.abs(b - tb);
}

async function main() {
  const { data, info } = await sharp(REF).raw().toBuffer({ resolveWithObject: true });
  const { width } = info;
  const hits = [];

  for (let y = 70; y < 500; y++) {
    for (let x = 620; x < 1450; x++) {
      const i = (y * width + x) * 3;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (dist(r, g, b, 34, 197, 94) < 40 || dist(r, g, b, 45, 210, 110) < 35) {
        hits.push({ x, y });
      }
    }
  }

  const clusters = [];
  for (const h of hits) {
    let cluster = clusters.find(
      (c) => Math.abs(c.x - h.x) < 30 && Math.abs(c.y - h.y) < 30,
    );
    if (!cluster) {
      cluster = { x: h.x, y: h.y, count: 0, minX: h.x, minY: h.y, maxX: h.x, maxY: h.y };
      clusters.push(cluster);
    }
    cluster.count++;
    cluster.x = (cluster.x * (cluster.count - 1) + h.x) / cluster.count;
    cluster.y = (cluster.y * (cluster.count - 1) + h.y) / cluster.count;
    cluster.minX = Math.min(cluster.minX, h.x);
    cluster.minY = Math.min(cluster.minY, h.y);
    cluster.maxX = Math.max(cluster.maxX, h.x);
    cluster.maxY = Math.max(cluster.maxY, h.y);
  }

  clusters.sort((a, b) => a.minY - b.minY || a.minX - b.minX);
  console.log(clusters.map((c) => ({
    center: [Math.round(c.x), Math.round(c.y)],
    box: [c.minX, c.minY, c.maxX, c.maxY],
    count: c.count,
  })));
}

main();
