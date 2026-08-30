/**
 * Allowlist-based SVG filter for the store-logo build scripts.
 *
 * Instead of matching-and-removing a set of "dangerous" substrings (regex
 * blocklists are bypassable), the input is scanned token-by-token and the
 * output is reconstructed from an allowlist: only known-safe elements and
 * known-safe attributes are re-emitted; everything else — processing
 * instructions, DOCTYPEs, CDATA, comments, scripts, foreign/unknown elements,
 * event handlers, external URL references — is discarded by construction, and
 * the text content of dropped subtrees never reaches the output.
 */

/** Elements that may appear in a vector logo and are safe to rasterize. */
const ALLOWED_TAGS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline",
  "polygon", "defs", "linearGradient", "radialGradient", "stop", "clipPath",
  "mask", "pattern", "symbol", "title", "desc", "text", "tspan", "use",
  "marker", "filter", "feGaussianBlur", "feOffset", "feMerge", "feMergeNode",
  "feColorMatrix", "feBlend", "feComposite", "feFlood", "solidColor", "style",
]);

/** Attributes allowed on allowed elements. Casing in the source is preserved. */
const ALLOWED_ATTRS = new Set([
  "id", "class", "role", "aria-label", "aria-hidden",
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "d", "points", "viewbox", "preserveaspectratio",
  "transform", "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity",
  "stroke-dasharray", "opacity", "clip-path", "clip-rule", "mask", "filter",
  "offset", "stop-color", "stop-opacity", "gradienttransform", "gradientunits",
  "spreadmethod", "patternunits", "patterncontentunits", "maskunits",
  "maskcontentunits", "clippathunits", "font-family", "font-size", "font-style",
  "font-weight", "font-variant", "letter-spacing", "text-anchor",
  "dominant-baseline", "style", "type", "xmlns", "xmlns:xlink", "xlink:href",
]);

/** Character set allowed inside a <style> element: plain SVG/CSS declarations
 *  only — no @import, url(), expression(), or any metacharacter that could
 *  smuggle an external reference in. */
const CSS_STYLE_CHARS = new Set(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%.,:;'\" -_/",
);

/** Text content of regular elements: block markup, keep everything else. */
function filterTextContent(text) {
  let out = "";
  for (const ch of text) {
    if (ch !== "<" && ch !== ">" && ch !== "\\" && ch !== "`") out += ch;
  }
  return out;
}

/** Style element content reduced to plain SVG/CSS declarations. */
function filterStyleContent(text) {
  let out = "";
  for (const ch of text) {
    if (CSS_STYLE_CHARS.has(ch)) out += ch;
  }
  return out;
}

function isSafeValue(aName, aValue) {
  const value = aValue;
  if (/[<>/\\]|javascript:|vbscript:|data:|file:/i.test(value)) return false;
  if (/\bexpression\s*\(/i.test(value)) return false;
  if (/@import/i.test(value)) return false;
  if (/url\(\s*(?!['"]?#)/i.test(value)) return false;
  const lower = aName.toLowerCase();
  if (lower === "href" || lower === "xlink:href") return value.trim().startsWith("#");
  if (lower === "xmlns") return value.trim() === "http://www.w3.org/2000/svg";
  if (lower === "xmlns:xlink") return value.trim() === "http://www.w3.org/1999/xlink";
  return true;
}

/**
 * Returns a sanitized, structurally-equivalent SVG document. Element and
 * attribute casing from the source is preserved; unknown elements (including
 * their text content) are removed entirely from the output; <style> bodies are
 * reduced to plain declarations; event handlers and external references are
 * never kept.
 */
export function filterSvgMarkup(svg) {
  const out = [];
  const tagStack = [];
  let dropped = 0;
  let i = 0;
  const len = svg.length;

  const emitText = (text) => {
    if (dropped > 0 || !text) return;
    const top = tagStack.length ? tagStack[tagStack.length - 1] : null;
    out.push(top && top.name === "style" ? filterStyleContent(text) : filterTextContent(text));
  };

  while (i < len) {
    const lt = svg.indexOf("<", i);
    if (lt < 0) {
      emitText(svg.slice(i));
      break;
    }
    if (lt > i) emitText(svg.slice(i, lt));
    const gt = svg.indexOf(">", lt);
    if (gt < 0) {
      emitText(svg.slice(lt));
      break;
    }
    const token = svg.slice(lt, gt + 1);
    const head = svg.slice(lt).toLowerCase();

    // Comments, DOCTYPEs, processing instructions, CDATA — dropped entirely.
    // Each must be consumed up to its own terminator, since the content (or a
    // nested tag inside a comment) may itself contain ">".
    const termEnd = (start, term) => {
      const idx = svg.indexOf(term, start);
      return idx < 0 ? len : idx + term.length;
    };
    if (head.startsWith("<!--")) {
      i = termEnd(lt + 4, "-->");
      continue;
    }
    if (head.startsWith("<?xml") || head.startsWith("<?")) {
      i = termEnd(lt + 2, "?>");
      continue;
    }
    if (head.startsWith("<![cdata[")) {
      i = termEnd(lt + 9, "]]>");
      continue;
    }
    if (head.startsWith("<!doctype")) {
      i = termEnd(lt + 2, ">");
      continue;
    }

    const isClose = token[1] === "/";
    const isSelfClose = /\/>$/.test(token);
    const body = isClose
      ? token.slice(2, -1)
      : isSelfClose
        ? token.slice(1, -2)
        : token.slice(1, -1);
    const nameMatch = /^[^\s/]+/.exec(body);
    if (!nameMatch) {
      i = gt + 1;
      continue;
    }
    const name = nameMatch[0];
    const lower = name.toLowerCase();

    if (isClose) {
      for (let k = tagStack.length - 1; k >= 0; k--) {
        const entry = tagStack[k];
        if (entry.name !== lower) continue;
        // Entries above the match are unclosed foreign elements — discard them.
        for (let j = tagStack.length - 1; j > k; j--) {
          if (!tagStack[j].allowed) dropped--;
          tagStack.pop();
        }
        if (entry.allowed && dropped === 0) out.push(`</${name}>`);
        tagStack.splice(k, 1);
        if (!entry.allowed) dropped--;
        break;
      }
      i = gt + 1;
      continue;
    }

    if (!ALLOWED_TAGS.has(lower)) {
      // Foreign/dangerous element: drop the whole subtree (incl. its text).
      if (!isSelfClose) {
        tagStack.push({ name: lower, allowed: false });
        dropped++;
      }
      i = gt + 1;
      continue;
    }

    const attrsOut = [];
    if (body.length > nameMatch[0].length) {
      const attrText = body.slice(nameMatch[0].length);
      const attrRe = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let am;
      while ((am = attrRe.exec(attrText)) !== null) {
        const aName = am[1];
        const aValue = am[3] !== undefined ? am[3] : am[4];
        if (ALLOWED_ATTRS.has(aName.toLowerCase()) && isSafeValue(aName, aValue)) {
          attrsOut.push(`${aName}="${aValue}"`);
        }
      }
    }

    if (dropped === 0) {
      out.push(
        `<${name}${attrsOut.length ? " " + attrsOut.join(" ") : ""}${isSelfClose ? "/>" : ">"}`
      );
    }
    if (!isSelfClose) {
      tagStack.push({ name: lower, allowed: true });
    }
    i = gt + 1;
  }

  return out.join("");
}