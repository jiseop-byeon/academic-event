/* Small SVG chart kit for Academic Event Radar.
   Every chart sizes itself to its container in CSS pixels (so 11px text stays 11px),
   redraws on resize, carries a hover/focus tooltip, and has a table-view twin. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var active = [];
  function L(en, ko) { return window.AER_LANG === "ko" ? ko : en; }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function monthTick(m) { return L(MON[m.getMonth()], (m.getMonth() + 1) + "월"); }

  function svg(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, cls, attrs) {
    var t = svg("text", Object.assign({ x: x, y: y, class: cls }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  var ctx2d = document.createElement("canvas").getContext("2d");
  function measure(str, size, weight) {
    var fam = getComputedStyle(document.body).fontFamily;
    ctx2d.font = (weight || 600) + " " + (size || 11) + "px " + fam;
    return ctx2d.measureText(str).width;
  }

  /* ---------------- tooltip ---------------- */
  var tipEl = null;
  function tip() {
    if (!tipEl) {
      tipEl = el("div", "tooltip");
      tipEl.setAttribute("role", "tooltip");
      tipEl.hidden = true;
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  // content: {title, rows: [{value, label, color}], note}
  function showTip(evt, content, anchor) {
    var t = tip();
    t.replaceChildren();
    if (content.title) t.appendChild(el("div", "tt-title", content.title));
    (content.rows || []).forEach(function (r) {
      var row = el("div", "tt-row");
      if (r.color) {
        var k = el("i", "tt-key");
        k.style.background = r.color;
        row.appendChild(k);
      }
      row.appendChild(el("b", null, r.value));
      if (r.label) row.appendChild(el("span", null, r.label));
      t.appendChild(row);
    });
    if (content.note) t.appendChild(el("div", "tt-note", content.note));
    t.hidden = false;
    var x, y;
    if (evt && evt.clientX !== undefined && evt.type !== "focus") {
      x = evt.clientX; y = evt.clientY;
    } else {
      var b = (anchor || evt.target).getBoundingClientRect();
      x = b.left + b.width / 2; y = b.bottom;
    }
    var r = t.getBoundingClientRect(), pad = 14;
    var left = x + pad, top = y + pad;
    if (left + r.width > window.innerWidth - 8) left = Math.max(8, x - r.width - pad);
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, y - r.height - pad);
    t.style.left = left + "px";
    t.style.top = top + "px";
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }
  function bindTip(node, content, href) {
    var c = typeof content === "function" ? content : function () { return content; };
    node.addEventListener("pointermove", function (e) { showTip(e, c()); });
    node.addEventListener("pointerleave", hideTip);
    node.addEventListener("focus", function (e) { showTip(e, c(), node); });
    node.addEventListener("blur", hideTip);
    if (href) {
      node.setAttribute("tabindex", "0");
      node.setAttribute("role", "link");
      node.style.cursor = "pointer";
      node.addEventListener("click", function () { hideTip(); location.hash = href; });
      node.addEventListener("keydown", function (e) { if (e.key === "Enter") { hideTip(); location.hash = href; } });
    }
  }
  window.addEventListener("scroll", hideTip, { passive: true });

  /* ---------------- figure wrapper (chart + table twin) ---------------- */
  // opts: {title, subtitle, legend: [{label, color, shape}], draw(div, width), table() -> {head, rows}, scroll, minWidth}
  function figure(parent, opts) {
    var fig = el("figure", "figure");
    var head = el("div", "figure-head");
    var g = el("div", "grow");
    g.appendChild(el("h3", null, opts.title));
    if (opts.subtitle) g.appendChild(el("p", null, opts.subtitle));
    head.appendChild(g);
    var btn = el("button", "view-btn", L("Table view", "표로 보기"));
    btn.type = "button";
    head.appendChild(btn);
    fig.appendChild(head);
    if (opts.legend && opts.legend.length) {
      var lg = el("div", "legend");
      opts.legend.forEach(function (l) {
        var s = el("span");
        var sw = el("i", "sw" + (l.shape ? " " + l.shape : ""));
        if (l.shape === "ring") sw.style.borderColor = l.color;
        else sw.style.background = l.color;
        s.appendChild(sw);
        s.appendChild(document.createTextNode(l.label));
        lg.appendChild(s);
      });
      fig.appendChild(lg);
    }
    var outer = el("div", opts.scroll ? "chart-scroll" : "");
    var chart = el("div", "chart");
    outer.appendChild(chart);
    fig.appendChild(outer);
    var tbl = el("div", "table-wrap");
    tbl.hidden = true;
    fig.appendChild(tbl);
    parent.appendChild(fig);

    var entry = {
      node: chart, lastW: 0,
      draw: function (force) {
        var w = Math.max(opts.minWidth || 0, outer.clientWidth || parent.clientWidth || 600);
        if (!force && Math.abs(w - entry.lastW) < 2) return;
        entry.lastW = w;
        chart.replaceChildren();
        opts.draw(chart, w);
      },
    };
    active.push(entry);
    entry.draw(true);

    btn.addEventListener("click", function () {
      var showTable = tbl.hidden;
      if (showTable && !tbl.firstChild) tbl.appendChild(renderTable(opts.table()));
      tbl.hidden = !showTable;
      outer.hidden = showTable;
      btn.textContent = showTable ? L("Chart view", "차트로 보기") : L("Table view", "표로 보기");
      if (!showTable) entry.draw(true);
    });
    return fig;
  }

  function renderTable(t) {
    var table = el("table", "data");
    var thead = el("thead"), tr = el("tr");
    t.head.forEach(function (h, i) {
      var th = el("th", t.numeric && t.numeric[i] ? "num" : "", h);
      th.scope = "col";
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
    var tb = el("tbody");
    t.rows.forEach(function (r) {
      var row = el("tr");
      r.forEach(function (c, i) { row.appendChild(el("td", t.numeric && t.numeric[i] ? "num" : "", c)); });
      tb.appendChild(row);
    });
    table.appendChild(tb);
    return table;
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      active = active.filter(function (a) { return a.node.isConnected; });
      active.forEach(function (a) { a.draw(false); });
    }, 120);
  });
  function reset() { active = []; hideTip(); }

  /* ---------------- helpers ---------------- */
  var DAY = 86400000;
  function d(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +(p[2] || 1)); }
  function monthStarts(start, end) {
    var out = [], m = new Date(start.getFullYear(), start.getMonth(), 1);
    if (m < start) m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    while (m <= end) { out.push(new Date(m)); m = new Date(m.getFullYear(), m.getMonth() + 1, 1); }
    return out;
  }

  /* ---------------- timeline (one row per item; deadlines → decision → event) ----------------
     rows: [{label, sub, href, emphasis, color, tip: {title, rows, note},
             marks: [{type: 'deadline'|'minor'|'ring'|'bar', date, end, est}]}]
     opts: {start, end, today, rowH, labelW} */
  function timeline(div, w, rows, opts) {
    var rowH = opts.rowH || 26, labelW = opts.labelW || 132, top = 34, right = 16;
    var H = top + rows.length * rowH + 8;
    var root = svg("svg", { width: w, height: H, viewBox: "0 0 " + w + " " + H, role: "img", "aria-label": opts.aria || "timeline" }, div);
    var x0 = labelW, x1 = w - right, t0 = opts.start.getTime(), t1 = opts.end.getTime();
    function X(date) { return x0 + ((date.getTime() - t0) / (t1 - t0)) * (x1 - x0); }

    var months = monthStarts(opts.start, opts.end);
    var every = (x1 - x0) / Math.max(1, months.length) < 34 ? 2 : 1;
    months.forEach(function (m, i) {
      var x = X(m), jan = m.getMonth() === 0;
      svg("line", { x1: x, x2: x, y1: top - 6, y2: H - 6, class: "grid-line" }, root);
      if (jan) svg("line", { x1: x, x2: x, y1: top - 18, y2: H - 6, class: "ax-line" }, root);
      if (i % every === 0 || jan) text(root, x + 3, top - 9, monthTick(m), "tick-label");
      if (jan || i === 0) text(root, x + 3, top - 22, String(m.getFullYear()), "tick-label", { "font-weight": 650 });
    });
    svg("line", { x1: x0, x2: x1, y1: top - 4, y2: top - 4, class: "ax-line" }, root);

    rows.forEach(function (r, i) {
      var y = top + i * rowH, cy = y + rowH / 2;
      var g = svg("g", { class: "row" }, root);
      svg("rect", { x: 0, y: y, width: w, height: rowH, class: "row-hover" }, g);
      text(g, 0, cy + 4, r.label, "row-label");
      if (r.sub) {
        var lw = measure(r.label, 12, 600);
        if (lw + 6 + measure(r.sub, 10.5, 400) < labelW - 8) text(g, lw + 6, cy + 4, r.sub, "row-sub");
      }
      var color = r.emphasis === false ? "var(--deemph)" : r.color || "var(--conf)";
      var ds = r.marks.map(function (m) { return d(m.date).getTime(); });
      ds = ds.concat(r.marks.filter(function (m) { return m.end; }).map(function (m) { return d(m.end).getTime(); }));
      var minT = Math.max(t0, Math.min.apply(null, ds)), maxT = Math.min(t1, Math.max.apply(null, ds));
      if (maxT > minT) svg("line", { x1: X(new Date(minT)), x2: X(new Date(maxT)), y1: cy, y2: cy, stroke: "var(--axis)", "stroke-width": 1 }, g);
      r.marks.forEach(function (m) {
        var md = d(m.date);
        if (md.getTime() < t0 - DAY && !(m.end && d(m.end).getTime() >= t0)) return;
        if (md.getTime() > t1) return;
        var x = X(md);
        if (m.type === "bar") {
          var xe = Math.max(x + 4, X(new Date(d(m.end || m.date).getTime() + DAY)));
          var xs = Math.max(x0, x);
          svg("rect", { x: xs, y: cy - 5, width: Math.max(4, Math.min(xe, x1) - xs), height: 10, rx: 3, fill: color, "fill-opacity": m.est ? 0.35 : 1 }, g);
        } else if (m.type === "ring") {
          svg("circle", { cx: x, cy: cy, r: 4, class: "ring-dot", stroke: color }, g);
        } else if (m.type === "minor") {
          svg("circle", { cx: x, cy: cy, r: 3, fill: color, stroke: "var(--bg)", "stroke-width": 1.5 }, g);
        } else {
          if (m.est) svg("circle", { cx: x, cy: cy, r: 5, fill: "var(--bg)", stroke: color, "stroke-width": 2, "stroke-dasharray": "2 1.6" }, g);
          else svg("circle", { cx: x, cy: cy, r: 5.5, fill: color, stroke: "var(--bg)", "stroke-width": 2 }, g);
        }
      });
      var hit = svg("rect", { x: 0, y: y, width: w, height: rowH, class: "hit" }, g);
      bindTip(hit, r.tip, r.href);
    });

    if (opts.today && opts.today >= opts.start && opts.today <= opts.end) {
      var tx = X(opts.today);
      svg("line", { x1: tx, x2: tx, y1: top - 4, y2: H - 4, class: "today-line" }, root);
      text(root, tx + 3, H - 1, L("Today", "오늘"), "today-label");
    }
    return root;
  }

  /* ---------------- strip: lanes × contribution (−2 … +2) ----------------
     lanes: [{key, label}]; items: [{lane, x, label, emphasis, color, tip, href}] */
  function strip(div, w, lanes, items, opts) {
    opts = opts || {};
    var labelW = w < 520 ? 74 : 96, right = 64, top = 30, bottom = 26, gap = 10, sub = 20;
    var x0 = labelW + 10, x1 = w - right;
    function X(v) { return x0 + ((v + 2) / 4) * (x1 - x0); }
    // dodge: in each lane, put a label on the first sub-row where it does not collide.
    var laneRows = {};
    lanes.forEach(function (l) { laneRows[l.key] = []; });
    var placed = items.slice().sort(function (a, b) { return a.x - b.x || (b.emphasis ? 1 : 0) - (a.emphasis ? 1 : 0); }).map(function (it) {
      var x = X(it.x), wl = measure(it.label, 11, it.emphasis ? 600 : 500) + 14;
      var rowsL = laneRows[it.lane];
      if (!rowsL) return null;
      var k = 0;
      while (k < rowsL.length && rowsL[k] > x - 6) k++;
      rowsL[k] = x + wl;
      return { it: it, x: x, k: k };
    }).filter(Boolean);
    var laneH = {}, laneY = {}, y = top;
    lanes.forEach(function (l) {
      laneH[l.key] = Math.max(1, laneRows[l.key].length) * sub + gap * 2;
      laneY[l.key] = y;
      y += laneH[l.key];
    });
    var H = y + bottom;
    var root = svg("svg", { width: w, height: H, viewBox: "0 0 " + w + " " + H, role: "img", "aria-label": opts.aria || "orientation chart" }, div);
    [-2, -1, 0, 1, 2].forEach(function (v) {
      svg("line", { x1: X(v), x2: X(v), y1: top - 4, y2: H - bottom + 2, class: v === 0 ? "ax-line" : "grid-line" }, root);
      text(root, X(v), H - 8, (v > 0 ? "+" : "") + v, "tick-label", { "text-anchor": "middle" });
    });
    text(root, x0, top - 12, L("← algorithm · theory", "← 알고리즘·이론"), "tick-label", { "font-weight": 650 });
    text(root, x1, top - 12, L("system · application →", "시스템·응용 →"), "tick-label", { "text-anchor": "end", "font-weight": 650 });
    lanes.forEach(function (l, i) {
      var ly = laneY[l.key];
      if (i > 0) svg("line", { x1: 0, x2: w, y1: ly, y2: ly, class: "grid-line" }, root);
      text(root, 0, ly + gap + 13, l.label, "lane-label");
    });
    placed.forEach(function (p) {
      var cy = laneY[p.it.lane] + gap + p.k * sub + 10;
      var g = svg("g", null, root);
      var color = p.it.emphasis ? p.it.color || "var(--conf)" : "var(--deemph)";
      svg("circle", { cx: p.x, cy: cy, r: p.it.emphasis ? 5.5 : 4.5, fill: color, stroke: "var(--bg)", "stroke-width": 2 }, g);
      text(g, p.x + 9, cy + 4, p.it.label, "mark-label" + (p.it.emphasis ? "" : " dim"));
      var wl = measure(p.it.label, 11, 600) + 16;
      var hit = svg("rect", { x: p.x - 9, y: cy - 10, width: wl + 4, height: 20, class: "hit" }, g);
      bindTip(hit, p.it.tip, p.it.href);
    });
    return root;
  }

  /* ---------------- horizontal bars ----------------
     items: [{label, value, valueLabel, emphasis, color, tip, href}] */
  function hbar(div, w, items, opts) {
    opts = opts || {};
    var rowH = opts.rowH || 24, labelW = Math.min(opts.labelW || 170, w * 0.42), right = 56, top = 4;
    var H = top + items.length * rowH + 4;
    var root = svg("svg", { width: w, height: H, viewBox: "0 0 " + w + " " + H, role: "img", "aria-label": opts.aria || "bar chart" }, div);
    var max = opts.max || Math.max.apply(null, items.map(function (i) { return i.value; })) || 1;
    var x0 = labelW + 8, x1 = w - right;
    svg("line", { x1: x0, x2: x0, y1: top, y2: H - 2, class: "ax-line" }, root);
    items.forEach(function (it, i) {
      var y = top + i * rowH, cy = y + rowH / 2;
      var g = svg("g", { class: "row" }, root);
      svg("rect", { x: 0, y: y, width: w, height: rowH, class: "row-hover" }, g);
      var lab = it.label, lw = labelW - 4;
      while (lab.length > 3 && measure(lab, 12, 600) > lw) lab = lab.slice(0, -2) + "…";
      text(g, labelW, cy + 4, lab, "row-label", { "text-anchor": "end", "font-weight": it.emphasis ? 650 : 500 });
      var bw = Math.max(2, ((x1 - x0) * it.value) / max);
      var color = it.emphasis === false ? "var(--deemph)" : it.color || "var(--conf)";
      var bh = Math.min(14, rowH - 8);
      svg("path", { d: barPath(x0, cy - bh / 2, bw, bh, 4), fill: color }, g);
      text(g, x0 + bw + 6, cy + 4, it.valueLabel || String(it.value), "val-label");
      var hit = svg("rect", { x: 0, y: y, width: w, height: rowH, class: "hit" }, g);
      bindTip(hit, it.tip || { title: it.label, rows: [{ value: it.valueLabel || String(it.value) }] }, it.href);
    });
    return root;
  }
  // bar with a square base at x and a 4px rounded data end
  function barPath(x, y, wd, h, r) {
    r = Math.min(r, wd / 2, h / 2);
    return "M" + x + "," + y + "H" + (x + wd - r) + "Q" + (x + wd) + "," + y + " " + (x + wd) + "," + (y + r) +
      "V" + (y + h - r) + "Q" + (x + wd) + "," + (y + h) + " " + (x + wd - r) + "," + (y + h) + "H" + x + "Z";
  }

  /* ---------------- ranges (min–max per row, grouped) ----------------
     groups: [{label, items: [{label, lo, hi, emphasis, color, tip, href}]}]; opts.ticks, opts.fmt */
  function ranges(div, w, groups, opts) {
    var rowH = 22, groupH = 26, labelW = Math.min(230, w * 0.44), right = 24, top = 26;
    var n = groups.reduce(function (s, g) { return s + g.items.length; }, 0);
    var H = top + n * rowH + groups.length * groupH + 6;
    var root = svg("svg", { width: w, height: H, viewBox: "0 0 " + w + " " + H, role: "img", "aria-label": opts.aria || "range chart" }, div);
    var x0 = labelW + 10, x1 = w - right, max = opts.max;
    function X(v) { return x0 + (Math.min(v, max) / max) * (x1 - x0); }
    opts.ticks.forEach(function (t) {
      svg("line", { x1: X(t), x2: X(t), y1: top - 6, y2: H - 4, class: t === 0 ? "ax-line" : "grid-line" }, root);
      text(root, X(t), top - 11, opts.fmt(t), "tick-label", { "text-anchor": "middle" });
    });
    var y = top;
    groups.forEach(function (g) {
      text(root, 0, y + 17, g.label, "lane-label");
      y += groupH;
      g.items.forEach(function (it) {
        var cy = y + rowH / 2;
        var row = svg("g", { class: "row" }, root);
        svg("rect", { x: 0, y: y, width: w, height: rowH, class: "row-hover" }, row);
        var lab = it.label;
        while (lab.length > 3 && measure(lab, 12, 500) > labelW - 6) lab = lab.slice(0, -2) + "…";
        text(row, labelW, cy + 4, lab, "row-label", { "text-anchor": "end", "font-weight": it.emphasis ? 650 : 500 });
        var color = it.emphasis === false ? "var(--deemph)" : it.color || "var(--intern)";
        var a = X(it.lo), b = X(it.hi);
        if (b - a > 2) svg("rect", { x: a, y: cy - 3, width: b - a, height: 6, rx: 3, fill: color, "fill-opacity": 0.45 }, row);
        svg("circle", { cx: a, cy: cy, r: 4.5, fill: color, stroke: "var(--bg)", "stroke-width": 2 }, row);
        if (b - a > 2) svg("circle", { cx: b, cy: cy, r: 4.5, fill: color, stroke: "var(--bg)", "stroke-width": 2 }, row);
        var hit = svg("rect", { x: 0, y: y, width: w, height: rowH, class: "hit" }, row);
        bindTip(hit, it.tip, it.href);
        y += rowH;
      });
    });
    return root;
  }

  /* ---------------- world map ----------------
     hosts: {CC: true}; points: [{lon, lat, label, n, color, tip, href}] */
  function worldMap(div, w, hosts, points, opts) {
    opts = opts || {};
    var W = window.WORLD;
    if (!W) { div.appendChild(el("p", "muted", L("The map could not be loaded.", "지도를 불러오지 못했습니다."))); return null; }
    var k = w / W.w, H = Math.round(W.h * k);
    var root = svg("svg", { width: w, height: H, viewBox: "0 0 " + W.w + " " + W.h, role: "img", "aria-label": opts.aria || "world map" }, div);
    var land = svg("g", null, root);
    Object.keys(W.shapes).forEach(function (code) {
      var p = svg("path", { d: W.shapes[code], class: "land" + (hosts[code] ? " host" + (opts.hostClass ? " " + opts.hostClass : "") : "") }, land);
      if (hosts[code] && opts.countryTip) bindTip(p, function () { return opts.countryTip(code); });
    });
    var s = 1 / k;  // keep dots and text at CSS-pixel size inside the scaled viewBox
    var boxes = [];
    points.sort(function (a, b) { return (b.n || 1) - (a.n || 1); }).forEach(function (pt) {
      var xy = W.project(pt.lon, pt.lat);
      var r = (4 + Math.sqrt(pt.n || 1) * 1.6) * s;
      var g = svg("g", null, root);
      svg("circle", { cx: xy[0], cy: xy[1], r: r, fill: pt.color || "var(--conf)", class: "map-dot", "stroke-width": 1.6 * s }, g);
      if (pt.label) {
        var fs = 11 * s, tw = measure(pt.label, 11, 600) * s, bx = xy[0] + r + 3 * s, by = xy[1] - fs * 0.7;
        if (bx + tw > W.w) bx = xy[0] - r - 3 * s - tw;
        var box = [bx, by, bx + tw, by + fs * 1.3];
        var clash = boxes.some(function (o) { return !(box[2] < o[0] || box[0] > o[2] || box[3] < o[1] || box[1] > o[3]); });
        if (!clash) {
          boxes.push(box);
          text(g, bx, xy[1] + fs * 0.35, pt.label, "mark-label", { "font-size": fs, "stroke-width": 3 * s });
        }
      }
      var hit = svg("circle", { cx: xy[0], cy: xy[1], r: Math.max(r, 12 * s), class: "hit" }, g);
      bindTip(hit, pt.tip, pt.href);
    });
    return root;
  }

  /* ---------------- single-row deadline strip for detail pages ----------------
     marks: [{date, label, type, est}] */
  function deadlineStrip(div, w, marks, opts) {
    opts = opts || {};
    var dates = marks.map(function (m) { return d(m.date).getTime(); });
    if (opts.today) dates.push(opts.today.getTime());
    var pad = 10 * DAY, t0 = Math.min.apply(null, dates) - pad, t1 = Math.max.apply(null, dates) + pad;
    var left = 12, right = 12, H = 96, cy = 48;
    var root = svg("svg", { width: w, height: H, viewBox: "0 0 " + w + " " + H, role: "img", "aria-label": "deadline strip" }, div);
    function X(t) { return left + ((t - t0) / (t1 - t0)) * (w - left - right); }
    svg("line", { x1: left, x2: w - right, y1: cy, y2: cy, class: "ax-line" }, root);
    var color = opts.color || "var(--conf)";
    var lastUp = -1e9, lastDown = -1e9;
    marks.slice().sort(function (a, b) { return d(a.date) - d(b.date); }).forEach(function (m) {
      var x = X(d(m.date).getTime());
      if (m.type === "bar" && m.end) {
        var xe = X(d(m.end).getTime() + DAY);
        svg("rect", { x: x, y: cy - 5, width: Math.max(4, xe - x), height: 10, rx: 3, fill: color, "fill-opacity": m.est ? 0.35 : 1 }, root);
      } else if (m.type === "ring") {
        svg("circle", { cx: x, cy: cy, r: 4.5, class: "ring-dot", stroke: color }, root);
      } else if (m.est) {
        svg("circle", { cx: x, cy: cy, r: 5, fill: "var(--bg)", stroke: color, "stroke-width": 2, "stroke-dasharray": "2 1.6" }, root);
      } else {
        svg("circle", { cx: x, cy: cy, r: 5.5, fill: color, stroke: "var(--bg)", "stroke-width": 2 }, root);
      }
      var lab = m.label + " " + m.short, tw = measure(lab, 11, 600);
      var up = x - tw / 2 > lastUp + 8 || x - tw / 2 <= lastDown + 8 ? true : false;
      if (up && x - tw / 2 < lastUp + 8) up = false;
      var ly = up ? cy - 14 : cy + 24;
      var anchor = "middle", lx = x;
      if (x - tw / 2 < 0) { anchor = "start"; lx = Math.max(0, x - 6); }
      if (x + tw / 2 > w) { anchor = "end"; lx = Math.min(w, x + 6); }
      text(root, lx, ly, lab, "mark-label", { "text-anchor": anchor });
      var extent = anchor === "middle" ? x + tw / 2 : anchor === "start" ? lx + tw : lx;
      if (up) lastUp = extent; else lastDown = extent;
    });
    if (opts.today) {
      var tx = X(opts.today.getTime());
      svg("line", { x1: tx, x2: tx, y1: cy - 26, y2: cy + 30, class: "today-line" }, root);
      text(root, tx + 3, H - 4, L("Today", "오늘"), "today-label");
    }
    return root;
  }

  window.Charts = {
    figure: figure, timeline: timeline, strip: strip, hbar: hbar, ranges: ranges,
    worldMap: worldMap, deadlineStrip: deadlineStrip, reset: reset, bindTip: bindTip,
    showTip: showTip, hideTip: hideTip, measure: measure,
  };
})();
