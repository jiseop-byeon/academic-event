/* Academic Event Radar — single-page app over data.json (built by scripts/build.py).
   Routes: #/  #/conferences[/id]  #/journals[/id]  #/internships[/id]  #/scholarships[/id]
           #/calendar  #/about        Views inside a page: ?view=... */
(function () {
  "use strict";

  var main = document.getElementById("main");
  var DATA = null, FIELD = {}, COMM = {};
  var TODAY = (function () { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
  var REPO = "https://github.com/jiseop-byeon/academic-event";

  var CATS = {
    conferences: { label: "학회", color: "var(--conf)" },
    journals: { label: "저널", color: "var(--journal)" },
    internships: { label: "인턴십", color: "var(--intern)" },
    scholarships: { label: "장학금", color: "var(--schol)" },
  };
  var ACTION = { abstract: 1, paper: 1, "late-breaking": 1, application: 1, internal: 1, recommendation: 1, "internship-deadline": 1 };
  var ORG_TYPE = { bigtech: "빅테크", robotics: "로봇 스타트업", "construction-robotics": "건설 로봇", "construction-tech": "건설 테크", construction: "건설사", autonomy: "자율주행", lab: "연구소·국책" };
  var STATUS = { open: "모집 중", upcoming: "모집 예정", rolling: "상시 모집", closed: "마감" };
  var SCH_ORG = { "korean-foundation": "한국 재단", "korean-government": "한국 정부", industry: "기업", "us-government": "미국 정부", society: "학회·협회", university: "대학", other: "기타" };
  var SCH_TYPE = { fellowship: "펠로십", scholarship: "장학금", "travel-grant": "여행 지원", "research-grant": "연구비", award: "상" };
  var CITIZEN = { none: "시민권 요건 없음", "us-person": "U.S. person 필요", "us-citizen": "미국 시민권 필요", "local-work-permit": "현지 취업 자격 필요", unknown: "자격 요건 확인 필요" };
  var MODE = { onsite: "상주", hybrid: "하이브리드", remote: "원격", unknown: "미상" };
  var BLIND = { double: "이중맹검 (double-blind)", single: "단일맹검 (single-blind)", open: "공개 심사" };
  var ACCESS = { subscription: "구독", hybrid: "하이브리드 OA", "open-access": "오픈 액세스" };
  var CONTRIB = { "-2": "이론·알고리즘 중심", "-1": "새 방법 우선", "0": "균형", "1": "시스템 검증 중시", "2": "응용·사례로 충분" };
  var TIER = { 1: "Tier 1 · 최상위", 2: "Tier 2 · 주요", 3: "Tier 3 · 전문/지역" };
  var KIND = {
    abstract: "초록 마감", paper: "논문 마감", supplementary: "보충자료", rebuttal: "반박(rebuttal)", notification: "결과 발표",
    "camera-ready": "최종본", "workshop-proposal": "워크숍 제안", "late-breaking": "LBR 마감", registration: "등록 마감", other: "기타",
    application: "지원 마감", internal: "학내 추천 마감", recommendation: "추천서 마감", interview: "면접", result: "결과 발표",
  };

  /* ================= format helpers ================= */
  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function d(s) { if (!s) return null; var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +(p[2] || 1)); }
  function days(s) { return Math.round((d(s) - TODAY) / 86400000); }
  var DOW = "일월화수목금토";
  function fmtDate(s, dow) {
    var x = d(s); if (!x) return "";
    var t = x.getFullYear() + "." + (x.getMonth() + 1) + "." + x.getDate();
    return dow ? t + " (" + DOW[x.getDay()] + ")" : t;
  }
  function fmtRange(a, b) {
    if (!a) return "";
    if (!b || a === b) return fmtDate(a);
    var x = d(a), y = d(b);
    if (x.getFullYear() !== y.getFullYear()) return fmtDate(a) + "–" + fmtDate(b);
    if (x.getMonth() !== y.getMonth()) return fmtDate(a) + "–" + (y.getMonth() + 1) + "." + y.getDate();
    return fmtDate(a) + "–" + y.getDate();
  }
  function ddayText(n) { return n === 0 ? "D-day" : n > 0 ? "D-" + n : "D+" + -n; }
  function dday(s, est) {
    var n = days(s), cls = n < 0 ? "past" : n <= 7 ? "urgent" : n <= 30 ? "soon" : "later";
    return '<span class="dday ' + cls + (est ? " est" : "") + '"' + (est ? ' title="과거 일정으로 추정한 날짜"' : "") + ">" +
      (est ? "≈" : "") + ddayText(n) + "</span>";
  }
  var SYM = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF ", CAD: "C$", SGD: "S$", AUD: "A$", CNY: "CN¥", HKD: "HK$", SEK: "SEK ", NOK: "NOK ", DKK: "DKK " };
  function money(v, cur) {
    if (typeof v !== "number") return "";
    if (cur === "KRW") {
      if (v >= 1e8) return (v / 1e8).toFixed(v % 1e8 ? 1 : 0) + "억원";
      if (v >= 1e4) return Math.round(v / 1e4).toLocaleString() + "만원";
      return v.toLocaleString() + "원";
    }
    var s = SYM[cur] || (cur ? cur + " " : "$");
    if (v >= 1e6) return s + (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1e4) return s + (v / 1e3).toFixed(v >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
    return s + v.toLocaleString();
  }
  var UNIT = { hour: "시간", week: "주", month: "월", year: "년", total: "총액", "one-time": "1회" };
  function payText(p) {
    if (!p) return "";
    return money(p.min, p.currency) + (p.max && p.max !== p.min ? "–" + money(p.max, p.currency) : "") + " / " + UNIT[p.unit];
  }
  function usdK(v) { return v >= 1000 ? "$" + (v / 1000).toFixed(1).replace(/\.0$/, "") + "k" : "$" + Math.round(v); }
  function payMonthly(p) {
    if (!p || !p.usd_month) return "";
    var a = p.usd_month[0], b = p.usd_month[1];
    return "≈ " + usdK(a) + (b !== a ? "–" + usdK(b) : "") + " / 월";
  }
  function pct(v) { return Math.round(v * 1000) / 10 + "%"; }
  function fieldName(k) { return k === "any" ? "전 분야" : FIELD[k] ? FIELD[k].label : k; }
  function fieldTags(arr, max) {
    var a = (arr || []).slice(0, max || 9);
    var more = (arr || []).length - a.length;
    return '<span class="tags">' + a.map(function (k) { return '<span class="tag">' + esc(fieldName(k)) + "</span>"; }).join("") +
      (more > 0 ? '<span class="tag">+' + more + "</span>" : "") + "</span>";
  }
  function stars(n) {
    return '<span class="stars" title="적합도 ' + n + '/3 (건설 Physical AI 연구 기준)" aria-label="적합도 ' + n + '/3">' +
      "★".repeat(n) + '<span class="off">' + "★".repeat(3 - n) + "</span></span>";
  }
  function scale(v) {
    if (typeof v !== "number") return "";
    var idx = Math.round(v) + 2, cells = "";
    for (var i = 0; i < 5; i++) {
      var on = idx >= 2 ? i >= 2 && i <= idx : i <= 2 && i >= idx;
      cells += '<i class="' + (on ? "on" : i === 2 ? "mid" : "") + '"></i>';
    }
    return '<span class="scale-wrap" title="성향 ' + (v > 0 ? "+" : "") + v + ' (−2 알고리즘 … +2 시스템)"><span class="scale" aria-hidden="true">' +
      cells + "</span><small>" + esc(CONTRIB[String(Math.round(v))]) + "</small></span>";
  }
  function flag(cc) {
    if (!cc || cc.length !== 2) return "";
    return String.fromCodePoint.apply(null, cc.toUpperCase().split("").map(function (c) { return 0x1f1e6 + c.charCodeAt(0) - 65; }));
  }
  var regionKo = (function () { try { return new Intl.DisplayNames(["ko"], { type: "region" }); } catch (e) { return null; } })();
  function country(cc) { try { return regionKo ? regionKo.of(cc) : cc; } catch (e) { return cc; } }
  function place(p) {
    if (!p || !p.city) return "";
    return '<span class="nowrap"><span class="flag" aria-hidden="true">' + flag(p.country) + "</span>" + esc(p.city) +
      (p.region ? ", " + esc(p.region) : "") + ", " + esc(country(p.country)) + "</span>";
  }
  function statusBadge(st) { return '<span class="badge ' + esc(st) + '"><i class="ico"></i>' + esc(STATUS[st] || st) + "</span>"; }
  function catLabel(cat) { return '<span class="cat-label"><i class="cat-dot cat-' + cat + '"></i>' + CATS[cat].label + "</span>"; }
  function stale(item) { return item.last_verified && days(item.last_verified) < -60; }
  function verified(item) {
    if (!item.last_verified) return "";
    return '<span class="' + (stale(item) ? "" : "muted") + '">' + fmtDate(item.last_verified) + " 확인" + (stale(item) ? " · 다시 확인 필요" : "") + "</span>";
  }
  function linkList(links) {
    var names = { home: "공식 홈페이지", cfp: "Call for papers", submit: "투고 시스템", guide: "투고 규정", author_guide: "저자 가이드",
      dblp: "DBLP", society: "주관 학회", dates: "주요 일정", program: "프로그램", apply: "지원 페이지", faq: "FAQ", notice: "공지" };
    var ks = Object.keys(links || {});
    if (!ks.length) return "";
    return "<ul>" + ks.map(function (k) { return '<li><a href="' + esc(links[k]) + '" target="_blank" rel="noopener">' + esc(names[k] || k.replace(/_/g, " ")) + "</a></li>"; }).join("") + "</ul>";
  }
  function sourceList(src) {
    return '<ol class="sources">' + (src || []).map(function (u) {
      var label = u.replace(/^https?:\/\/(www\.)?/, "");
      if (label.length > 70) label = label.slice(0, 67) + "…";
      return '<li><a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(label) + "</a></li>";
    }).join("") + "</ol>";
  }
  function shortName(s) { return String(s).replace(/\s*\(.*\)\s*$/, ""); }

  /* ================= persistent state ================= */
  var store = {
    get: function (k, def) { try { var v = localStorage.getItem("aer." + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem("aer." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  var selFields = new Set(store.get("fields", []));
  var minFit = store.get("minFit", 2);
  function fitToggle(bar, onChange) {
    toggleBox(bar, "적합도 ★★ 이상만", minFit >= 2, function (v) { minFit = v ? 2 : 1; store.set("minFit", minFit); onChange(); });
  }
  function matchFields(item) {
    if (!selFields.size) return true;
    return (item.fields || []).some(function (f) { return f === "any" || selFields.has(f); });
  }
  function matchText(item, q, keys) {
    if (!q) return true;
    q = q.toLowerCase();
    return keys.some(function (k) {
      var v = item[k];
      if (Array.isArray(v)) v = v.join(" ");
      return v && String(v).toLowerCase().indexOf(q) >= 0;
    });
  }

  /* ================= small DOM builders ================= */
  function node(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function page(title, lead) {
    main.innerHTML = '<div class="page-head"><h1>' + esc(title) + "</h1>" + (lead ? "<p>" + lead + "</p>" : "") + "</div>";
  }
  function filtersBar() { var f = node('<div class="filters" role="search"></div>'); main.appendChild(f); return f; }
  function fieldChips(bar, items, onChange) {
    var counts = {};
    items.forEach(function (it) { (it.fields || []).forEach(function (f) { counts[f] = (counts[f] || 0) + 1; }); });
    var g = node('<div class="group" aria-label="분야 필터"><span class="group-label">분야</span></div>');
    DATA.fields.forEach(function (f) {
      if (!counts[f.key] && !selFields.has(f.key)) return;
      var b = node('<button type="button" class="chip" aria-pressed="' + selFields.has(f.key) + '" title="' + esc(f.label_en) + '">' +
        esc(f.label) + ' <span class="count">' + (counts[f.key] || 0) + "</span></button>");
      b.addEventListener("click", function () {
        if (selFields.has(f.key)) selFields.delete(f.key); else selFields.add(f.key);
        store.set("fields", Array.from(selFields));
        b.setAttribute("aria-pressed", selFields.has(f.key));
        onChange();
      });
      g.appendChild(b);
    });
    bar.appendChild(g);
  }
  function chipSet(bar, label, options, set, onChange) {
    var g = node('<div class="group"><span class="group-label">' + esc(label) + "</span></div>");
    options.forEach(function (o) {
      var b = node('<button type="button" class="chip" aria-pressed="' + set.has(o.value) + '">' + esc(o.label) +
        (o.count !== undefined ? ' <span class="count">' + o.count + "</span>" : "") + "</button>");
      b.addEventListener("click", function () {
        if (set.has(o.value)) set.delete(o.value); else set.add(o.value);
        b.setAttribute("aria-pressed", set.has(o.value));
        onChange();
      });
      g.appendChild(b);
    });
    bar.appendChild(g);
  }
  function selectBox(bar, label, options, value, onChange) {
    var s = node("<select aria-label=\"" + esc(label) + "\">" + options.map(function (o) {
      return '<option value="' + esc(o.value) + '"' + (o.value === value ? " selected" : "") + ">" + esc(o.label) + "</option>";
    }).join("") + "</select>");
    s.addEventListener("change", function () { onChange(s.value); });
    var g = node('<div class="group"><span class="group-label">' + esc(label) + "</span></div>");
    g.appendChild(s);
    bar.appendChild(g);
  }
  function toggleBox(bar, label, checked, onChange) {
    var l = node('<label class="toggle"><input type="checkbox"' + (checked ? " checked" : "") + "> " + esc(label) + "</label>");
    l.querySelector("input").addEventListener("change", function (e) { onChange(e.target.checked); });
    bar.appendChild(l);
  }
  function searchBox(bar, placeholder, value, onInput) {
    var g = node('<div class="group search"><input type="search" placeholder="' + esc(placeholder) + '" aria-label="검색" value="' + esc(value || "") + '"></div>');
    var t = null;
    g.querySelector("input").addEventListener("input", function (e) {
      clearTimeout(t);
      t = setTimeout(function () { onInput(e.target.value.trim()); }, 120);
    });
    bar.appendChild(node('<span class="spacer"></span>'));
    bar.appendChild(g);
  }
  function tabs(route, views, current) {
    var seg = node('<div class="seg" role="tablist" aria-label="보기"></div>');
    views.forEach(function (v) {
      var b = node('<button type="button" role="tab" aria-pressed="' + (v.key === current) + '" aria-selected="' + (v.key === current) + '">' + esc(v.label) + "</button>");
      b.addEventListener("click", function () { location.hash = "#/" + route + (v.key === views[0].key ? "" : "?view=" + v.key); });
      seg.appendChild(b);
    });
    var row = node('<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:-4px 0 14px"></div>');
    row.appendChild(seg);
    var count = node('<span class="result-count" aria-live="polite"></span>');
    row.appendChild(count);
    main.appendChild(row);
    return count;
  }
  function sortableTable(container, cols, rows, state, rerender, rowCls) {
    var col = cols.filter(function (c) { return c.key === state.sort.key; })[0] || cols[0];
    var sorted = rows.slice();
    if (col.sort) sorted.sort(function (a, b) {
      var va = col.sort(a), vb = col.sort(b);
      if ((va === null || va === undefined) && (vb === null || vb === undefined)) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * state.sort.dir;
    });
    container.innerHTML = '<div class="table-wrap"><table class="data"><thead><tr>' + cols.map(function (c) {
      var sortAttr = c.sort ? ' aria-sort="' + (c.key === state.sort.key ? (state.sort.dir > 0 ? "ascending" : "descending") : "none") + '"' : "";
      return '<th scope="col"' + (c.num ? ' class="num"' : "") + sortAttr + ">" +
        (c.sort ? '<button type="button" data-sort="' + c.key + '">' + esc(c.label) + "</button>" : esc(c.label)) + "</th>";
    }).join("") + "</tr></thead><tbody>" + sorted.map(function (r) {
      return "<tr" + (rowCls && rowCls(r) ? ' class="' + rowCls(r) + '"' : "") + ">" + cols.map(function (c) {
        return "<td" + (c.num ? ' class="num"' : c.cls ? ' class="' + c.cls + '"' : "") + ">" + c.render(r) + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody></table></div>";
    container.querySelectorAll("[data-sort]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-sort");
        var c = cols.filter(function (x) { return x.key === k; })[0];
        if (state.sort.key === k) state.sort.dir *= -1; else { state.sort.key = k; state.sort.dir = c && c.desc ? -1 : 1; }
        rerender();
      });
    });
  }
  function empty(msg) { return '<div class="empty">' + (msg || "조건에 맞는 항목이 없습니다. 필터를 줄여 보세요.") + "</div>"; }

  /* ================= derived data ================= */
  function confInfo(c) {
    if (c._i) return c._i;
    var eds = (c.editions || []).slice().sort(function (a, b) { return a.year - b.year || (d(a.start) || 0) - (d(b.start) || 0); });
    var upcoming = eds.filter(function (e) { return !e.end || days(e.end) >= 0; });
    var subs = [];
    eds.forEach(function (e) {
      (e.deadlines || []).forEach(function (dl) {
        if ((dl.kind === "paper" || dl.kind === "abstract") && days(dl.date) >= 0)
          subs.push({ date: dl.date, kind: dl.kind, tz: dl.tz, time: dl.time, edition: e, est: !!dl.estimated || e.status === "estimated" });
      });
    });
    subs.sort(function (a, b) { return d(a.date) - d(b.date); });
    c._i = { eds: eds, next: upcoming[0] || null, nextSub: subs[0] || null, subs: subs };
    return c._i;
  }
  function internStatus(i) { return i.deadline && days(i.deadline) < 0 ? "closed" : i.status; }
  function scholInfo(s) {
    if (s._i) return s._i;
    var dls = ((s.cycle || {}).deadlines || []).slice().sort(function (a, b) { return d(a.date) - d(b.date); });
    var future = dls.filter(function (x) { return days(x.date) >= 0 && x.kind !== "result" && x.kind !== "interview"; });
    var status = s.status;
    if (status !== "rolling") {
      if (!future.length) status = "closed";
      else if (status === "closed") status = "upcoming";
    }
    s._i = { dls: dls, next: future[0] || null, status: status };
    return s._i;
  }
  function jif(j) { var m = (j.metrics || {}).jif; return m ? m.value : null; }

  /* ================= router ================= */
  var lastPath = null;
  function route() {
    if (!DATA) return;
    Charts.reset();
    var h = location.hash.replace(/^#\/?/, "");
    var qi = h.indexOf("?");
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var q = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : "");
    var parts = path.split("/").filter(Boolean);
    var top = parts[0] || "";
    document.querySelectorAll(".nav a").forEach(function (a) {
      if (a.getAttribute("data-route") === top) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (path !== lastPath) window.scrollTo(0, 0);
    lastPath = path;
    var pages = {
      "": dashboard, conferences: parts[1] ? confDetail : conferences, journals: parts[1] ? journalDetail : journals,
      internships: parts[1] ? internDetail : internships, scholarships: parts[1] ? scholDetail : scholarships,
      calendar: calendar, about: about,
    };
    (pages[top] || notFound)(q, parts[1] && decodeURIComponent(parts[1]));
  }
  function notFound() { page("페이지를 찾을 수 없습니다", '<a href="#/">대시보드로 돌아가기</a>'); }
  function findItem(cat, id) { return (DATA[cat] || []).filter(function (x) { return x.id === id; })[0]; }

  /* ================= dashboard ================= */
  function dashboard() {
    document.title = "Academic Event Radar";
    var built = DATA.meta.built_at ? fmtDate(DATA.meta.built_at.slice(0, 10)) : "";
    page("Academic Event Radar",
      "건설 Physical AI — 접촉이 많은 조작(manipulation)을 중심으로 내비게이션·HRI·인식까지 — 연구에 맞춘 학회·저널·인턴십·장학금 정보입니다. " +
      "에이전트가 공식 페이지를 확인해 갱신하며, 과거 일정으로 추정한 날짜는 <b>≈</b>와 점선으로 구분합니다. <span class=\"faint\">마지막 빌드 " + esc(built) + "</span>");
    var bar = filtersBar();
    var all = [].concat(DATA.conferences, DATA.journals, DATA.internships, DATA.scholarships);
    var body = node("<div></div>");
    fieldChips(bar, all, render);
    bar.appendChild(node('<span class="spacer"></span>'));
    fitToggle(bar, render);
    main.appendChild(body);
    render();

    function render() {
      var ev = DATA.events.filter(function (e) { return ACTION[e.kind] && days(e.date) >= 0 && matchFields(e) && e.fit >= minFit; });
      var in30 = ev.filter(function (e) { return days(e.date) <= 30; });
      var interns = DATA.internships.filter(function (i) { var s = internStatus(i); return (s === "open" || s === "rolling") && matchFields(i) && i.fit >= minFit; });
      var schols = DATA.scholarships.filter(function (s) { var i = scholInfo(s); return i.status !== "closed" && matchFields(s) && s.fit >= minFit; });
      var nextConf = ev.filter(function (e) { return e.cat === "conferences" && (e.kind === "paper" || e.kind === "abstract"); })[0];
      var schSoon = schols.filter(function (s) { var n = scholInfo(s).next; return n && days(n.date) <= 45; });

      var html = '<div class="kpis">' +
        kpi("#/calendar", "30일 안의 마감", in30.length, in30[0] ? esc(in30[0].cat === "conferences" ? in30[0].name : in30[0].short || in30[0].name) + " · " + esc(in30[0].label) + " · " + ddayText(days(in30[0].date)) : "없음") +
        kpi("#/internships", catLabel("internships") + " 모집 중", interns.length,
          interns.filter(function (i) { return i.citizenship === "none"; }).length + "건 시민권 요건 없음") +
        kpi("#/scholarships", catLabel("scholarships") + " 지원 가능", schols.length, schSoon.length + "건 45일 안에 마감") +
        kpi(nextConf ? "#/conferences/" + nextConf.id : "#/conferences", catLabel("conferences") + " 다음 제출 마감", nextConf ? esc(nextConf.short || nextConf.name) : "—",
          nextConf ? esc(nextConf.label) + " · " + fmtDate(nextConf.date) + " · " + ddayText(days(nextConf.date)) : "") +
        "</div>";

      // upcoming list
      var soon = ev.filter(function (e) { return days(e.date) <= 120; });
      html += '<section class="section"><h2>다가오는 마감 <span class="muted">120일 · ' + soon.length + "건</span></h2>";
      html += soon.length ? deadlineList(soon) : empty("120일 안의 마감이 없습니다.");
      html += "</section>";

      html += '<section class="section"><h2>12개월 마감 지도 <span class="muted">달마다 무엇이 마감되는지 · 점선은 추정</span></h2>' + yearMap(ev) + "</section>";

      html += '<section class="section"><h2>추천 <span class="muted">적합도 ★★★ · 마감이 가까운 순</span></h2><div class="picks">' +
        pickCol("conferences", DATA.conferences.filter(matchFields).filter(function (c) { return c.fit === 3; }).sort(function (a, b) {
          var x = confInfo(a).nextSub, y = confInfo(b).nextSub; return (x ? d(x.date) : 9e15) - (y ? d(y.date) : 9e15);
        })) +
        pickCol("journals", DATA.journals.filter(matchFields).filter(function (j) { return j.fit === 3; }).sort(function (a, b) { return (jif(b) || 0) - (jif(a) || 0); })) +
        pickCol("internships", interns.filter(function (i) { return i.fit === 3; }).sort(function (a, b) {
          return (a.deadline || "9999").localeCompare(b.deadline || "9999") || (b.posted || "").localeCompare(a.posted || "");
        })) +
        pickCol("scholarships", schols.filter(function (s) { return s.fit === 3; }).sort(function (a, b) {
          var x = scholInfo(a).next, y = scholInfo(b).next; return (x ? d(x.date) : 9e15) - (y ? d(y.date) : 9e15);
        })) + "</div></section>";

      var log = (DATA.changelog || []).slice(0, 8);
      html += '<section class="section"><h2>업데이트 기록 <span class="muted">에이전트 실행마다 한 줄</span></h2><ul class="changelog">' +
        log.map(function (l) { return '<li><span class="muted num">' + esc(fmtDate(l.date)) + "</span><span>" + esc(l.summary) + (l.by ? ' <span class="faint">· ' + esc(l.by) + "</span>" : "") + "</span></li>"; }).join("") +
        "</ul></section>";
      body.innerHTML = html;
      var more = body.querySelector(".more-btn");
      if (more) more.addEventListener("click", function () {
        body.querySelectorAll(".deadline-list .extra").forEach(function (x) { x.hidden = false; });
        more.remove();
      });
    }
  }
  function kpi(href, label, value, sub) {
    return '<a class="kpi" href="' + href + '"><div class="label">' + label + '</div><div class="value">' + value + '</div><div class="sub">' + sub + "</div></a>";
  }
  function deadlineList(evs) {
    var html = '<ul class="deadline-list">', month = "", shown = 0, LIMIT = 14;
    evs.forEach(function (e) {
      var x = d(e.date), m = x.getFullYear() + "년 " + (x.getMonth() + 1) + "월";
      var extra = shown >= LIMIT;
      if (m !== month) { html += '<li class="month' + (extra ? " extra" : "") + '"' + (extra ? " hidden" : "") + ">" + m + "</li>"; month = m; }
      html += '<li class="item' + (extra ? " extra" : "") + '"' + (extra ? " hidden" : "") + ">" +
        '<span class="date">' + fmtDate(e.date).slice(5) + " (" + DOW[x.getDay()] + ")</span>" +
        "<span>" + dday(e.date, e.estimated) + "</span>" +
        '<span class="what"><a href="#/' + e.cat + "/" + esc(e.id) + '">' + esc(e.name) + '</a><span class="sub">' +
        catLabel(e.cat) + "<span>" + esc(e.label) + (e.tz ? " · " + esc((e.time ? e.time + " " : "") + e.tz) : "") + "</span>" +
        (e.estimated ? '<span class="badge est">추정</span>' : "") + "</span></span>" +
        '<span class="fitcol">' + stars(e.fit) + "</span></li>";
      shown++;
    });
    html += "</ul>";
    if (shown > LIMIT) html += '<button type="button" class="btn more-btn">' + (shown - LIMIT) + "건 더 보기</button>";
    return html;
  }
  function yearMap(ev) {
    var months = [];
    for (var i = 0; i < 12; i++) months.push(new Date(TODAY.getFullYear(), TODAY.getMonth() + i, 1));
    var cats = ["conferences", "internships", "scholarships"];
    var cell = {};
    ev.forEach(function (e) {
      var x = d(e.date), k = e.cat + "|" + x.getFullYear() + "-" + x.getMonth();
      var list = cell[k] || (cell[k] = []);
      if (list.some(function (o) { return o.id === e.id; })) return;
      list.push(e);
    });
    function chips(cat, m) {
      var list = cell[cat + "|" + m.getFullYear() + "-" + m.getMonth()] || [];
      var out = list.slice(0, 7).map(function (e) {
        var nm = e.short || shortName(e.name);
        return '<a class="cat-' + cat + (e.estimated ? " est" : "") + '" href="#/' + cat + "/" + esc(e.id) + '" title="' +
          esc(e.name + " · " + e.label + " · " + fmtDate(e.date) + (e.estimated ? " (추정)" : "")) + '">' + esc(nm) + "</a>";
      }).join("");
      if (list.length > 7) out += '<span class="faint">+' + (list.length - 7) + "</span>";
      return out;
    }
    function mlabel(m, i) { return (i === 0 || m.getMonth() === 0 ? "’" + String(m.getFullYear()).slice(2) + " " : "") + (m.getMonth() + 1) + "월"; }
    var wide = '<div class="yearmap wide" style="grid-template-columns:92px repeat(12,minmax(0,1fr))"><div class="yh"></div>' +
      months.map(function (m, i) { return '<div class="yh' + (i === 0 ? " now" : "") + '">' + mlabel(m, i) + "</div>"; }).join("");
    cats.forEach(function (cat) {
      wide += '<div class="yl">' + catLabel(cat) + "</div>" + months.map(function (m) { return '<div class="yc">' + chips(cat, m) + "</div>"; }).join("");
    });
    wide += "</div>";
    var narrow = '<div class="yearmap narrow" style="grid-template-columns:64px repeat(3,minmax(0,1fr))"><div class="yh"></div>' +
      cats.map(function (c) { return '<div class="yh">' + catLabel(c) + "</div>"; }).join("");
    months.forEach(function (m, i) {
      narrow += '<div class="yl">' + mlabel(m, i) + "</div>" + cats.map(function (c) { return '<div class="yc">' + chips(c, m) + "</div>"; }).join("");
    });
    narrow += "</div>";
    return wide + narrow;
  }
  function pickCol(cat, items) {
    var top = items.slice(0, 4);
    return '<div class="pick-col"><h3>' + catLabel(cat) + '</h3><ol>' + (top.length ? top.map(function (it) {
      var name = cat === "conferences" ? it.acronym : cat === "journals" ? it.abbr : cat === "internships" ? it.company + " · " + it.title : shortName(it.name);
      return '<li><a href="#/' + cat + "/" + esc(it.id) + '">' + esc(name) + "</a><p>" + esc(it.take) + "</p></li>";
    }).join("") : '<li class="muted">해당 분야의 ★★★ 항목이 없습니다.</li>') + "</ol></div>";
  }

  /* ================= conferences ================= */
  var confState = { community: "", tier: "", q: "", sort: { key: "sub", dir: 1 }, ready: "" };
  function conferences(q) {
    document.title = "학회 · Academic Event Radar";
    var view = q.get("view") || "list";
    page("학회", "다음 개최지와 일정, 제출 마감, 그리고 각 학회가 무엇을 높이 사는지(성향). 성향은 −2(새 알고리즘·이론이 있어야 함)부터 +2(시스템·응용 검증만으로 충분)까지입니다.");
    var bar = filtersBar();
    fieldChips(bar, DATA.conferences, render);
    selectBox(bar, "커뮤니티", [{ value: "", label: "전체" }].concat(DATA.communities.map(function (c) { return { value: c.key, label: c.label }; })), confState.community, function (v) { confState.community = v; render(); });
    selectBox(bar, "등급", [{ value: "", label: "전체" }, { value: "1", label: "Tier 1" }, { value: "2", label: "Tier 2" }, { value: "3", label: "Tier 3" }], confState.tier, function (v) { confState.tier = v; render(); });
    searchBox(bar, "학회 이름·도시 검색", confState.q, function (v) { confState.q = v; render(); });
    var count = tabs("conferences", [
      { key: "list", label: "목록" }, { key: "timeline", label: "타임라인" }, { key: "map", label: "개최지 지도" },
      { key: "orientation", label: "성향 지도" }, { key: "planner", label: "제출 플래너" },
    ], view);
    var out = node("<div></div>");
    main.appendChild(out);
    render();

    function items() {
      return DATA.conferences.filter(function (c) {
        var n = confInfo(c).next || {};
        return matchFields(c) && (!confState.community || c.community === confState.community) &&
          (!confState.tier || String(c.tier) === confState.tier) &&
          (!confState.q || matchText(Object.assign({ city: n.city, ctry: n.country ? country(n.country) : "" }, c), confState.q, ["acronym", "name", "organizer", "city", "ctry"]));
      });
    }
    function render() {
      Charts.reset();
      var list = items();
      count.textContent = list.length + "개 학회";
      out.replaceChildren();
      if (!list.length) { out.innerHTML = empty(); return; }
      ({ list: confList, timeline: confTimeline, map: confMap, orientation: confOrientation, planner: confPlanner }[view] || confList)(out, list, render);
    }
  }
  function narrow() { return window.innerWidth < 700; }
  function confCards(out, list) {
    var sorted = list.slice().sort(function (a, b) {
      var x = confInfo(a).nextSub, y = confInfo(b).nextSub;
      return (x ? d(x.date) : 9e15) - (y ? d(y.date) : 9e15);
    });
    out.innerHTML = '<div class="cards">' + sorted.map(function (c) {
      var n = confInfo(c).next, s = confInfo(c).nextSub, a = (c.review || {}).acceptance_rate;
      return '<article class="card"><div class="top"><div class="grow"><div class="eyebrow">' + catLabel("conferences") + "<span>" + esc(COMM[c.community] ? COMM[c.community].label : "") + " · Tier " + c.tier + "</span></div>" +
        '<h3><a href="#/conferences/' + esc(c.id) + '">' + esc(c.acronym) + '</a></h3><div class="small muted">' + esc(c.name) + "</div></div>" + stars(c.fit) + "</div>" +
        '<dl class="meta"><dt>다음 개최</dt><dd>' + (n ? (n.start ? fmtRange(n.start, n.end) : n.year + "년") + (n.status === "estimated" ? " (추정)" : "") + (n.city ? "<br>" + place(n) : "") : '<span class="faint">미정</span>') + "</dd>" +
        "<dt>다음 제출</dt><dd>" + (s ? fmtDate(s.date) + " " + dday(s.date, s.est) + ' <small class="muted">' + esc(s.edition.year + " " + KIND[s.kind]) + "</small>" : '<span class="faint">미정</span>') + "</dd>" +
        (a ? "<dt>채택률</dt><dd>" + pct(a.value) + ' <small class="muted">' + a.year + "</small></dd>" : "") +
        "<dt>성향</dt><dd>" + scale(c.orientation.contribution) + "</dd></dl>" +
        '<p class="take">' + esc(c.take) + "</p></article>";
    }).join("") + "</div>";
  }
  function confList(out, list, rerender) {
    if (narrow()) return confCards(out, list);
    var cols = [
      { key: "name", label: "학회", cls: "name", sort: function (c) { return c.acronym.toLowerCase(); },
        render: function (c) { return '<a href="#/conferences/' + esc(c.id) + '">' + esc(c.acronym) + "</a><small>" + esc(c.name) + "</small>"; } },
      { key: "fields", label: "분야", render: function (c) { return fieldTags(c.fields, 3); } },
      { key: "next", label: "다음 개최", sort: function (c) { var n = confInfo(c).next; return n && n.start ? n.start : null; },
        render: function (c) {
          var n = confInfo(c).next;
          if (!n) return '<span class="faint">미정</span>';
          return '<span class="nowrap">' + (n.start ? fmtRange(n.start, n.end) : n.year + "년") + "</span>" + (n.status === "estimated" ? ' <span class="badge est">추정</span>' : "") +
            "<br>" + (n.city ? place(n) : '<span class="faint">장소 미정</span>');
        } },
      { key: "sub", label: "다음 제출 마감", sort: function (c) { var s = confInfo(c).nextSub; return s ? s.date : null; },
        render: function (c) {
          var s = confInfo(c).nextSub;
          if (!s) return '<span class="faint">미정</span>';
          return '<span class="nowrap">' + fmtDate(s.date) + "</span> " + dday(s.date, s.est) + '<br><small class="muted">' + esc(c.acronym + " " + s.edition.year + " · " + KIND[s.kind]) + "</small>";
        } },
      { key: "acc", label: "채택률", num: true, desc: true, sort: function (c) { var a = (c.review || {}).acceptance_rate; return a ? a.value : null; },
        render: function (c) { var a = (c.review || {}).acceptance_rate; return a ? pct(a.value) + ' <small class="muted">' + a.year + "</small>" : '<span class="faint">비공개</span>'; } },
      { key: "contrib", label: "성향", sort: function (c) { return c.orientation.contribution; }, render: function (c) { return scale(c.orientation.contribution); } },
      { key: "fit", label: "적합도", desc: true, sort: function (c) { return c.fit; }, render: function (c) { return stars(c.fit); } },
    ];
    sortableTable(out, cols, list, confStateSort(), rerender);
  }
  function confStateSort() { return confState; }
  function confTimeline(out, list) {
    var start = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1), end = new Date(TODAY.getFullYear(), TODAY.getMonth() + 15, 0);
    var rows = list.slice().sort(function (a, b) {
      var x = confInfo(a).nextSub, y = confInfo(b).nextSub;
      return (x ? d(x.date) : 9e15) - (y ? d(y.date) : 9e15);
    }).map(function (c) {
      var marks = [], tipRows = [];
      confInfo(c).eds.forEach(function (e) {
        var est = e.status === "estimated";
        (e.deadlines || []).forEach(function (dl) {
          var type = dl.kind === "paper" ? "deadline" : dl.kind === "abstract" ? "minor" : dl.kind === "notification" ? "ring" : null;
          if (!type) return;
          marks.push({ type: type, date: dl.date, est: est || dl.estimated });
          if (d(dl.date) >= start && d(dl.date) <= end) tipRows.push({ value: fmtDate(dl.date) + (est || dl.estimated ? " ≈" : ""), label: e.year + " " + KIND[dl.kind] });
        });
        if (e.start) {
          marks.push({ type: "bar", date: e.start, end: e.end, est: est });
          if (d(e.end || e.start) >= start && d(e.start) <= end) tipRows.push({ value: fmtRange(e.start, e.end) + (est ? " ≈" : ""), label: e.year + " 개최 · " + (e.city || "") });
        }
      });
      var n = confInfo(c).next;
      return {
        label: c.acronym, sub: n && n.city ? "’" + String(n.year).slice(2) + " " + n.city : "", href: "#/conferences/" + c.id,
        emphasis: c.fit === 3, color: "var(--conf)", marks: marks,
        tip: { title: c.acronym + " · " + c.name, rows: tipRows, note: c.take },
      };
    });
    Charts.figure(out, {
      title: "제출 → 결과 → 개최 타임라인",
      subtitle: "다음 제출 마감이 가까운 순. 적합도 ★★★ 학회는 파란색, 나머지는 회색. 점선 원과 옅은 막대는 추정 일정.",
      legend: [
        { label: "논문 마감", color: "var(--conf)" }, { label: "초록 마감", color: "var(--conf)", shape: "small" },
        { label: "결과 발표", color: "var(--conf)", shape: "ring" }, { label: "개최 기간", color: "var(--conf)", shape: "bar" },
      ],
      scroll: true, minWidth: 720,
      draw: function (div, w) { Charts.timeline(div, w, rows, { start: start, end: end, today: TODAY, labelW: 150, aria: "학회 타임라인" }); },
      table: function () {
        return { head: ["학회", "일정"], rows: rows.map(function (r) { return [r.label, r.tip.rows.map(function (x) { return x.label + " " + x.value; }).join(" · ")]; }) };
      },
    });
  }
  function confMap(out, list) {
    var byCity = {}, hosts = {}, byCountry = {};
    list.forEach(function (c) {
      var n = confInfo(c).next;
      if (!n || !n.country) return;
      hosts[n.country] = true;
      (byCountry[n.country] = byCountry[n.country] || []).push({ c: c, n: n });
      if (typeof n.lat !== "number") return;
      var k = n.lat.toFixed(1) + "," + n.lon.toFixed(1);
      var g = byCity[k] || (byCity[k] = { lat: n.lat, lon: n.lon, city: n.city, country: n.country, list: [] });
      g.list.push({ c: c, n: n });
    });
    var points = Object.keys(byCity).map(function (k) {
      var g = byCity[k];
      return {
        lat: g.lat, lon: g.lon, n: g.list.length, color: "var(--conf)",
        label: g.list.map(function (x) { return x.c.acronym; }).join(", "),
        href: g.list.length === 1 ? "#/conferences/" + g.list[0].c.id : null,
        tip: { title: flag(g.country) + " " + g.city + ", " + country(g.country), rows: g.list.map(function (x) { return { value: x.c.acronym + " " + x.n.year, label: fmtRange(x.n.start, x.n.end) + (x.n.status === "estimated" ? " (추정)" : "") }; }) },
      };
    });
    Charts.figure(out, {
      title: "다음 개최지",
      subtitle: "각 학회의 다음 개최 도시. 색칠된 나라는 개최국. 점이 클수록 그 도시에서 열리는 학회가 많습니다.",
      draw: function (div, w) {
        Charts.worldMap(div, w, hosts, points, {
          aria: "학회 개최지 지도",
          countryTip: function (cc) { return { title: flag(cc) + " " + country(cc), rows: byCountry[cc].map(function (x) { return { value: x.c.acronym + " " + x.n.year, label: x.n.city + " · " + fmtRange(x.n.start, x.n.end) }; }) }; },
        });
      },
      table: function () {
        return { head: ["학회", "도시", "국가", "일정"], rows: list.map(function (c) { var n = confInfo(c).next || {}; return [c.acronym, n.city || "미정", n.country ? country(n.country) : "", n.start ? fmtRange(n.start, n.end) : ""]; }) };
      },
    });
    var ccs = Object.keys(byCountry).sort(function (a, b) { return byCountry[b].length - byCountry[a].length || country(a).localeCompare(country(b)); });
    var html = '<section class="section"><h2>나라별 <span class="muted">' + ccs.length + "개국</span></h2>" +
      '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">개최국</th><th scope="col">학회 · 도시 · 일정</th></tr></thead><tbody>' +
      ccs.map(function (cc) {
        return '<tr><td class="nowrap"><span class="flag" aria-hidden="true">' + flag(cc) + "</span>" + esc(country(cc)) + ' <span class="muted">' + byCountry[cc].length + "</span></td><td>" +
          byCountry[cc].sort(function (a, b) { return d(a.n.start) - d(b.n.start); }).map(function (x) {
            return '<a href="#/conferences/' + esc(x.c.id) + '">' + esc(x.c.acronym + " " + x.n.year) + "</a> " + esc(x.n.city || "") + ' <span class="muted">' + esc(fmtRange(x.n.start, x.n.end)) + "</span>";
          }).join("<br>") + "</td></tr>";
      }).join("") + "</tbody></table></div></section>";
    out.insertAdjacentHTML("beforeend", html);
  }
  function orientationFigure(out, list, cat, nameKey) {
    var lanes = DATA.communities.filter(function (c) { return list.some(function (x) { return x.community === c.key; }); });
    var color = cat === "journals" ? "var(--journal)" : "var(--conf)";
    var items = list.map(function (x) {
      return {
        lane: x.community, x: x.orientation.contribution, label: x[nameKey], emphasis: x.fit === 3, color: color,
        href: "#/" + cat + "/" + x.id,
        tip: { title: x[nameKey] + " · " + x.name, rows: [
          { value: CONTRIB[String(Math.round(x.orientation.contribution))], label: "성향" },
          { value: "★".repeat(x.fit) + "☆".repeat(3 - x.fit), label: "적합도" },
        ], note: x.orientation.summary },
      };
    });
    Charts.figure(out, {
      title: "성향 지도 — 무엇을 기여로 인정하는가",
      subtitle: "가로: 새 알고리즘·이론이 필요한 곳(왼쪽) ↔ 시스템 통합·현장 검증만으로 충분한 곳(오른쪽). 세로: 주 청중 커뮤니티. 색 점 = 적합도 ★★★.",
      legend: [{ label: "적합도 ★★★ (직접 목표)", color: color }, { label: "그 외", color: "var(--deemph)" }],
      draw: function (div, w) { Charts.strip(div, w, lanes, items, { aria: "성향 지도" }); },
      table: function () {
        return { head: ["이름", "커뮤니티", "성향", "적합도", "요약"], rows: list.map(function (x) {
          return [x[nameKey], COMM[x.community] ? COMM[x.community].label : x.community, (x.orientation.contribution > 0 ? "+" : "") + x.orientation.contribution + " " + CONTRIB[String(Math.round(x.orientation.contribution))], x.fit + "/3", x.orientation.summary];
        }) };
      },
    });
  }
  function confOrientation(out, list) { orientationFigure(out, list, "conferences", "acronym"); }
  function confPlanner(out, list) {
    var def = confState.ready || iso(new Date(TODAY.getTime() + 21 * 86400000));
    var form = node('<div class="planner-form"><label for="ready">원고 완성 예정일</label><input id="ready" type="date" value="' + def + '">' +
      '<span class="muted small">이 날짜 뒤에 오는 첫 제출 마감(초록 또는 논문)을 학회마다 찾아, 결과 발표·개최까지 보여 줍니다.</span></div>');
    out.appendChild(form);
    var res = node("<div></div>");
    out.appendChild(res);
    form.querySelector("input").addEventListener("change", function (e) { confState.ready = e.target.value; draw(); });
    draw();
    function draw() {
      var ready = form.querySelector("input").value || def;
      var rows = [];
      list.forEach(function (c) {
        var cand = [];
        confInfo(c).eds.forEach(function (e) {
          (e.deadlines || []).forEach(function (dl) {
            if ((dl.kind === "paper" || dl.kind === "abstract") && dl.date >= ready) cand.push({ dl: dl, e: e });
          });
        });
        cand.sort(function (a, b) { return d(a.dl.date) - d(b.dl.date); });
        if (cand[0]) rows.push({ c: c, dl: cand[0].dl, e: cand[0].e });
      });
      rows.sort(function (a, b) { return d(a.dl.date) - d(b.dl.date); });
      if (!rows.length) { res.innerHTML = empty("그 날짜 뒤로 알려진 마감이 없습니다."); return; }
      res.innerHTML = '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">학회</th><th scope="col">첫 마감</th><th scope="col" class="num">여유</th><th scope="col">결과 발표</th><th scope="col">개최</th><th scope="col">적합도</th></tr></thead><tbody>' +
        rows.map(function (r) {
          var est = r.dl.estimated || r.e.status === "estimated";
          var note = (r.e.deadlines || []).filter(function (x) { return x.kind === "notification"; })[0];
          var slack = Math.round((d(r.dl.date) - d(ready)) / 86400000);
          return '<tr><td class="name"><a href="#/conferences/' + esc(r.c.id) + '">' + esc(r.c.acronym + " " + r.e.year) + "</a><small>" + esc(r.c.name) + "</small></td>" +
            '<td class="nowrap">' + fmtDate(r.dl.date) + " " + dday(r.dl.date, est) + '<br><small class="muted">' + esc(KIND[r.dl.kind]) + (r.dl.tz ? " · " + esc(r.dl.tz) : "") + "</small></td>" +
            '<td class="num">' + slack + "일</td>" +
            '<td class="nowrap">' + (note ? fmtDate(note.date) + (note.estimated || est ? " ≈" : "") : '<span class="faint">—</span>') + "</td>" +
            "<td>" + (r.e.start ? '<span class="nowrap">' + fmtRange(r.e.start, r.e.end) + "</span><br>" : "") + (r.e.city ? place(r.e) : "") + "</td>" +
            "<td>" + stars(r.c.fit) + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<p class="muted small" style="margin-top:10px">저널은 마감 없이 상시 투고입니다 — <a href="#/journals">저널 목록</a>. RA-L은 ICRA/IROS 발표 경로가 있어 학회 마감과 함께 계획하세요.</p>';
    }
  }
  function iso(x) { return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }

  function confDetail(q, id) {
    var c = findItem("conferences", id);
    if (!c) return notFound();
    document.title = c.acronym + " · 학회 · Academic Event Radar";
    var info = confInfo(c), r = c.review || {}, rk = c.rankings || {};
    var html = '<div class="crumbs"><a href="#/conferences">학회</a> / ' + esc(c.acronym) + "</div>" +
      '<div class="detail-head"><div class="grow"><div class="eyebrow">' + catLabel("conferences") + "<span>" + esc(COMM[c.community] ? COMM[c.community].label : "") + "</span>" +
      '<span class="badge">' + esc(TIER[c.tier]) + "</span>" + fieldTags(c.fields) + "</div>" +
      "<h1>" + esc(c.acronym) + '</h1><div class="full">' + esc(c.name) + ' <span class="muted">· ' + esc(c.organizer) + "</span></div></div>" +
      '<div class="detail-actions">' + (c.links && c.links.home ? '<a class="btn" href="' + esc(c.links.home) + '" target="_blank" rel="noopener">공식 홈페이지 ↗</a>' : "") +
      (info.next && info.next.url ? '<a class="btn primary" href="' + esc(info.next.url) + '" target="_blank" rel="noopener">' + esc(c.acronym + " " + info.next.year) + " 사이트 ↗</a>" : "") + "</div></div>" +
      '<div class="take-box"><b>한 줄 평</b>' + esc(c.take) + "</div>" +
      '<div class="detail"><div class="col-main">';
    var upcoming = info.eds.filter(function (e) { return !e.end || days(e.end) >= -1; });
    if (!upcoming.length) upcoming = info.eds.slice(-1);
    upcoming.forEach(function (e, i) {
      html += '<section class="panel"><h2>' + (i === 0 ? "다음 개최 · " : "그다음 · ") + esc(c.acronym + " " + e.year) + " " +
        (e.status === "estimated" ? '<span class="badge est">추정</span>' : e.status === "announced" ? '<span class="badge">일정·장소 발표</span>' : '<span class="badge open"><i class="ico"></i>공식 확정</span>') + "</h2>" +
        '<dl class="kv"><dt>일정</dt><dd>' + (e.start ? fmtRange(e.start, e.end) + " " + dday(e.start, e.status === "estimated") : '<span class="faint">미정</span>') + "</dd>" +
        "<dt>장소</dt><dd>" + (e.city ? place(e) + (e.venue ? ' <span class="muted">· ' + esc(e.venue) + "</span>" : "") : '<span class="faint">미정</span>') + "</dd>" +
        (e.notes ? "<dt>메모</dt><dd>" + esc(e.notes) + "</dd>" : "") + "</dl>" +
        '<div class="chart dl-timeline" data-edition="' + i + '"></div>' +
        ((e.deadlines || []).length ? '<div class="table-wrap" style="margin-top:6px"><table class="data"><thead><tr><th scope="col">구분</th><th scope="col">날짜</th><th scope="col">남은 기간</th><th scope="col">시각</th></tr></thead><tbody>' +
          e.deadlines.slice().sort(function (a, b) { return d(a.date) - d(b.date); }).map(function (dl) {
            var est = dl.estimated || e.status === "estimated";
            return "<tr><td>" + esc(dl.label || KIND[dl.kind]) + '</td><td class="nowrap">' + fmtDate(dl.date, true) + "</td><td>" + dday(dl.date, est) + "</td><td>" + esc([dl.time, dl.tz].filter(Boolean).join(" ")) + "</td></tr>";
          }).join("") + "</tbody></table></div>" : '<p class="muted">마감 일정이 아직 발표되지 않았습니다.</p>') + "</section>";
    });
    html += '<section class="panel"><h2>성향</h2><p>' + scale(c.orientation.contribution) + "</p><p>" + esc(c.orientation.summary) + "</p>" +
      '<div class="tags">' + (c.orientation.values || []).map(function (v) { return '<span class="tag">' + esc(v) + "</span>"; }).join("") + "</div></section>" +
      '<section class="panel"><h2>심사·형식</h2><dl class="kv">' +
      (r.blind ? "<dt>심사 방식</dt><dd>" + esc(BLIND[r.blind]) + "</dd>" : "") +
      (r.rebuttal !== undefined ? "<dt>반박(rebuttal)</dt><dd>" + (r.rebuttal ? "있음" : "없음") + "</dd>" : "") +
      "<dt>채택률</dt><dd>" + (r.acceptance_rate ? pct(r.acceptance_rate.value) + " (" + r.acceptance_rate.year + ")" + (r.acceptance_rate.note ? ' <span class="muted">' + esc(r.acceptance_rate.note) + "</span>" : "") : '<span class="faint">공식 발표 없음</span>') + "</dd>" +
      (c.paper_format ? "<dt>원고 형식</dt><dd>" + esc(c.paper_format) + "</dd>" : "") +
      (c.proceedings ? "<dt>논문집</dt><dd>" + esc(c.proceedings) + "</dd>" : "") +
      (c.journal_track ? "<dt>저널 연계</dt><dd>" + esc(c.journal_track) + "</dd>" : "") +
      (c.attendance ? "<dt>참가 규모</dt><dd>" + esc(c.attendance) + "</dd>" : "") + "</dl></section>";
    html += '</div><aside class="col-side"><section class="panel"><h2>한눈에</h2><dl class="kv">' +
      "<dt>적합도</dt><dd>" + stars(c.fit) + "</dd>" +
      "<dt>등급</dt><dd>" + esc(TIER[c.tier]) + "</dd>" +
      (rk.core ? "<dt>CORE</dt><dd>" + esc(rk.core) + "</dd>" : "") +
      (rk.h5_index ? "<dt>h5-index</dt><dd>" + rk.h5_index + (rk.h5_year ? ' <span class="muted">(' + rk.h5_year + ")</span>" : "") + "</dd>" : "") +
      "<dt>주기</dt><dd>" + esc({ annual: "매년", biennial: "격년", irregular: "부정기" }[c.frequency] || c.frequency) + "</dd>" +
      "<dt>확인일</dt><dd>" + verified(c) + "</dd></dl></section>" +
      (c.links ? '<section class="panel"><h2>링크</h2>' + linkList(c.links) + "</section>" : "") +
      '<section class="panel"><h2>출처</h2>' + sourceList(c.sources) + "</section></aside></div>";
    main.innerHTML = html;
    upcoming.forEach(function (e, i) {
      var div = main.querySelector('[data-edition="' + i + '"]');
      var marks = (e.deadlines || []).filter(function (dl) { return ["abstract", "paper", "notification", "camera-ready", "rebuttal"].indexOf(dl.kind) >= 0; }).map(function (dl) {
        return { date: dl.date, label: KIND[dl.kind], short: fmtDate(dl.date).slice(5), type: dl.kind === "notification" ? "ring" : "dot", est: dl.estimated || e.status === "estimated" };
      });
      if (e.start) marks.push({ date: e.start, end: e.end, label: "개최", short: fmtDate(e.start).slice(5), type: "bar", est: e.status === "estimated" });
      if (marks.length < 2) { div.remove(); return; }
      var drawIt = function () { div.replaceChildren(); Charts.deadlineStrip(div, div.clientWidth || 600, marks, { today: TODAY, color: "var(--conf)" }); };
      drawIt();
      window.addEventListener("resize", debounce(drawIt, 150));
    });
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(function () { if (main.isConnected) fn(); }, ms); }; }

  /* ================= journals ================= */
  var jState = { community: "", access: "", q1: false, q: "", sort: { key: "jif", dir: -1 } };
  function journals(q) {
    document.title = "저널 · Academic Event Radar";
    var view = q.get("view") || "list";
    page("저널", "Impact Factor·분위(Q1–Q4)·심사 속도와 각 저널의 성향 — 새 알고리즘이 있어야 하는지, 시스템·현장 검증만으로 충분한지. IF는 Clarivate JCR 값(연도 표기)이고 저널 공식 페이지에서 확인했습니다.");
    var bar = filtersBar();
    fieldChips(bar, DATA.journals, render);
    selectBox(bar, "커뮤니티", [{ value: "", label: "전체" }].concat(DATA.communities.map(function (c) { return { value: c.key, label: c.label }; })), jState.community, function (v) { jState.community = v; render(); });
    selectBox(bar, "접근", [{ value: "", label: "전체" }, { value: "subscription", label: "구독" }, { value: "hybrid", label: "하이브리드 OA" }, { value: "open-access", label: "오픈 액세스" }], jState.access, function (v) { jState.access = v; render(); });
    toggleBox(bar, "JCR Q1만", jState.q1, function (v) { jState.q1 = v; render(); });
    searchBox(bar, "저널·출판사 검색", jState.q, function (v) { jState.q = v; render(); });
    var count = tabs("journals", [{ key: "list", label: "목록" }, { key: "if", label: "IF 비교" }, { key: "orientation", label: "성향 지도" }], view);
    var out = node("<div></div>");
    main.appendChild(out);
    render();
    function render() {
      Charts.reset();
      var list = DATA.journals.filter(function (j) {
        var qv = ((j.metrics || {}).jcr_quartile || {}).value || ((j.metrics || {}).sjr || {}).quartile;
        return matchFields(j) && (!jState.community || j.community === jState.community) && (!jState.access || j.access === jState.access) &&
          (!jState.q1 || qv === "Q1") && matchText(j, jState.q, ["abbr", "name", "publisher"]);
      });
      count.textContent = list.length + "개 저널";
      out.replaceChildren();
      if (!list.length) { out.innerHTML = empty(); return; }
      if (view === "if") return journalIF(out, list);
      if (view === "orientation") return orientationFigure(out, list, "journals", "abbr");
      journalList(out, list, render);
    }
  }
  function quartile(j) {
    var m = j.metrics || {}, jq = m.jcr_quartile, sq = m.sjr;
    var out = "";
    if (jq && jq.value) out += '<span class="badge q ' + jq.value.toLowerCase() + '" title="JCR ' + esc(jq.category || "") + '">' + esc(jq.value) + "</span>";
    else if (sq && sq.quartile) out += '<span class="badge q ' + sq.quartile.toLowerCase() + '" title="SJR ' + esc(sq.category || "") + '">' + esc(sq.quartile) + "</span>";
    var cat = (jq && jq.category) || (sq && sq.category);
    if (cat) out += '<br><small class="muted">' + esc((jq && jq.value ? "JCR " : "SJR ") + cat) + "</small>";
    return out || '<span class="faint">—</span>';
  }
  function journalCards(out, list) {
    var sorted = list.slice().sort(function (a, b) { return (jif(b) || 0) - (jif(a) || 0); });
    out.innerHTML = '<div class="cards">' + sorted.map(function (j) {
      var m = j.metrics || {};
      return '<article class="card"><div class="top"><div class="grow"><div class="eyebrow">' + catLabel("journals") + "<span>" + esc(COMM[j.community] ? COMM[j.community].label : "") + " · " + esc(j.publisher) + "</span></div>" +
        '<h3><a href="#/journals/' + esc(j.id) + '">' + esc(j.abbr) + '</a></h3><div class="small muted">' + esc(j.name) + "</div></div>" + stars(j.fit) + "</div>" +
        '<dl class="meta"><dt>IF</dt><dd>' + (m.jif ? "<b>" + m.jif.value + '</b> <small class="muted">' + m.jif.year + "</small>" : '<span class="faint">없음</span>') + "</dd>" +
        "<dt>분위</dt><dd>" + quartile(j) + "</dd>" +
        ((j.review || {}).first_decision_days ? "<dt>첫 결정</dt><dd>약 " + j.review.first_decision_days + "일</dd>" : "") +
        "<dt>접근</dt><dd>" + esc(ACCESS[j.access] || j.access) + (j.apc_usd ? " · APC " + money(j.apc_usd, "USD") : "") + "</dd>" +
        "<dt>성향</dt><dd>" + scale(j.orientation.contribution) + "</dd></dl>" +
        '<p class="take">' + esc(j.take) + "</p></article>";
    }).join("") + "</div>";
  }
  function journalList(out, list, rerender) {
    if (narrow()) return journalCards(out, list);
    var cols = [
      { key: "name", label: "저널", cls: "name", sort: function (j) { return j.abbr.toLowerCase(); },
        render: function (j) { return '<a href="#/journals/' + esc(j.id) + '">' + esc(j.abbr) + "</a><small>" + esc(j.name) + " · " + esc(j.publisher) + "</small>"; } },
      { key: "jif", label: "IF", num: true, desc: true, sort: function (j) { return jif(j); },
        render: function (j) { var m = (j.metrics || {}).jif; return m ? "<b>" + m.value + '</b> <small class="muted">' + m.year + "</small>" : '<span class="faint">없음</span>'; } },
      { key: "jif5", label: "5년 IF", num: true, desc: true, sort: function (j) { var m = (j.metrics || {}).jif_5y; return m ? m.value : null; },
        render: function (j) { var m = (j.metrics || {}).jif_5y; return m ? String(m.value) : '<span class="faint">—</span>'; } },
      { key: "q", label: "분위", sort: function (j) { var m = j.metrics || {}; return (m.jcr_quartile || {}).value || (m.sjr || {}).quartile || null; }, render: quartile },
      { key: "cs", label: "CiteScore", num: true, desc: true, sort: function (j) { var m = (j.metrics || {}).citescore; return m ? m.value : null; },
        render: function (j) { var m = (j.metrics || {}).citescore; return m ? String(m.value) : '<span class="faint">—</span>'; } },
      { key: "h5", label: "h5", num: true, desc: true, sort: function (j) { var m = (j.metrics || {}).h5_index; return m ? m.value : null; },
        render: function (j) { var m = (j.metrics || {}).h5_index; return m ? String(m.value) : '<span class="faint">—</span>'; } },
      { key: "speed", label: "첫 결정", num: true, sort: function (j) { return (j.review || {}).first_decision_days || null; },
        render: function (j) { var v = (j.review || {}).first_decision_days; return v ? v + "일" : '<span class="faint">—</span>'; } },
      { key: "access", label: "접근·APC", render: function (j) { return esc(ACCESS[j.access] || j.access) + (j.apc_usd ? '<br><small class="muted">APC ' + money(j.apc_usd, "USD") + "</small>" : ""); } },
      { key: "contrib", label: "성향", sort: function (j) { return j.orientation.contribution; }, render: function (j) { return scale(j.orientation.contribution); } },
      { key: "fit", label: "적합도", desc: true, sort: function (j) { return j.fit; }, render: function (j) { return stars(j.fit); } },
    ];
    sortableTable(out, cols, list, jState, rerender);
  }
  function journalIF(out, list) {
    var withIF = list.filter(function (j) { return jif(j) !== null; }).sort(function (a, b) { return jif(b) - jif(a); });
    Charts.figure(out, {
      title: "Journal Impact Factor",
      subtitle: "Clarivate JCR 값, 높은 순. 보라색 = 적합도 ★★★ 저널. IF는 분야마다 기준이 달라 같은 커뮤니티 안에서 비교하세요.",
      legend: [{ label: "적합도 ★★★", color: "var(--journal)", shape: "bar" }, { label: "그 외", color: "var(--deemph)", shape: "bar" }],
      draw: function (div, w) {
        Charts.hbar(div, w, withIF.map(function (j) {
          var m = j.metrics.jif;
          return { label: j.abbr, value: m.value, valueLabel: m.value + " (" + m.year + ")", emphasis: j.fit === 3, color: "var(--journal)", href: "#/journals/" + j.id,
            tip: { title: j.abbr + " · " + j.name, rows: [{ value: String(m.value), label: "IF " + m.year }].concat(j.metrics.jif_5y ? [{ value: String(j.metrics.jif_5y.value), label: "5년 IF" }] : []), note: j.take } };
        }), { aria: "저널 IF 막대 그래프", labelW: 150 });
      },
      table: function () { return { head: ["저널", "IF", "연도", "적합도"], numeric: [false, true, true, true], rows: withIF.map(function (j) { return [j.abbr, String(j.metrics.jif.value), String(j.metrics.jif.year), j.fit + "/3"]; }) }; },
    });
    var noIF = list.filter(function (j) { return jif(j) === null; });
    if (noIF.length) out.insertAdjacentHTML("beforeend", '<p class="muted small" style="margin-top:10px">IF가 없는 저널: ' + noIF.map(function (j) { return '<a href="#/journals/' + esc(j.id) + '">' + esc(j.abbr) + "</a>"; }).join(", ") + " — 새 저널이거나 JCR에 등재되지 않은 곳입니다.</p>");
  }
  function journalDetail(q, id) {
    var j = findItem("journals", id);
    if (!j) return notFound();
    document.title = j.abbr + " · 저널 · Academic Event Radar";
    var m = j.metrics || {}, r = j.review || {};
    function tile(label, v, sub) { return '<div class="metric"><div class="label">' + label + '</div><div class="value">' + v + '</div><div class="sub">' + (sub || "") + "</div></div>"; }
    var tiles = "";
    if (m.jif) tiles += tile("Impact Factor", m.jif.value, "JCR " + m.jif.year);
    if (m.jif_5y) tiles += tile("5년 IF", m.jif_5y.value, "JCR " + m.jif_5y.year);
    if (m.jcr_quartile) tiles += tile("JCR 분위", esc(m.jcr_quartile.value), esc(m.jcr_quartile.category || "") + (m.jcr_quartile.rank ? " · " + esc(m.jcr_quartile.rank) : ""));
    if (m.citescore) tiles += tile("CiteScore", m.citescore.value, "Scopus " + m.citescore.year);
    if (m.sjr) tiles += tile("SJR", m.sjr.value, (m.sjr.quartile ? esc(m.sjr.quartile) + " · " : "") + esc(m.sjr.category || "") + " " + m.sjr.year);
    if (m.h_index) tiles += tile("h-index", m.h_index, "SCImago");
    if (m.h5_index && m.h5_index.value) tiles += tile("h5-index", m.h5_index.value, "Google Scholar " + (m.h5_index.year || ""));
    if (m.papers_published && m.papers_published.value) tiles += tile("게재 논문 수", m.papers_published.value.toLocaleString(), esc(m.papers_published.note || m.papers_published.year || ""));
    if (j.openalex && j.openalex.two_year_mean_citedness) tiles += tile("2년 평균 피인용", j.openalex.two_year_mean_citedness.toFixed(2), "OpenAlex · 자동 갱신");
    var html = '<div class="crumbs"><a href="#/journals">저널</a> / ' + esc(j.abbr) + "</div>" +
      '<div class="detail-head"><div class="grow"><div class="eyebrow">' + catLabel("journals") + "<span>" + esc(COMM[j.community] ? COMM[j.community].label : "") + "</span>" +
      '<span class="badge">' + esc(TIER[j.tier]) + "</span>" + fieldTags(j.fields) + "</div><h1>" + esc(j.abbr) + '</h1><div class="full">' + esc(j.name) + ' <span class="muted">· ' + esc(j.publisher) + "</span></div></div>" +
      '<div class="detail-actions">' + (j.links && j.links.home ? '<a class="btn" href="' + esc(j.links.home) + '" target="_blank" rel="noopener">저널 홈페이지 ↗</a>' : "") +
      (j.links && j.links.submit ? '<a class="btn primary" href="' + esc(j.links.submit) + '" target="_blank" rel="noopener">투고하기 ↗</a>' : "") + "</div></div>" +
      '<div class="take-box"><b>한 줄 평</b>' + esc(j.take) + "</div>" +
      '<div class="detail"><div class="col-main"><section class="panel"><h2>지표</h2>' + (tiles ? '<div class="metric-tiles">' + tiles + "</div>" : '<p class="muted">공개된 지표가 없습니다.</p>') + "</section>" +
      '<section class="panel"><h2>성향</h2><p>' + scale(j.orientation.contribution) + "</p><p>" + esc(j.orientation.summary) + "</p>" +
      '<div class="tags">' + (j.orientation.values || []).map(function (v) { return '<span class="tag">' + esc(v) + "</span>"; }).join("") + "</div></section>" +
      '<section class="panel"><h2>심사·투고</h2><dl class="kv">' +
      (r.blind ? "<dt>심사 방식</dt><dd>" + esc(BLIND[r.blind]) + "</dd>" : "") +
      (r.first_decision_days ? "<dt>첫 결정까지</dt><dd>약 " + r.first_decision_days + "일</dd>" : "") +
      (r.acceptance_rate ? "<dt>채택률</dt><dd>" + pct(r.acceptance_rate) + "</dd>" : "") +
      (r.speed_note ? "<dt>속도 메모</dt><dd>" + esc(r.speed_note) + "</dd>" : "") +
      "<dt>접근</dt><dd>" + esc(ACCESS[j.access] || j.access) + (j.apc_usd ? " · APC " + money(j.apc_usd, "USD") : "") + "</dd>" +
      (j.length ? "<dt>분량</dt><dd>" + esc(j.length) + "</dd>" : "") +
      (j.article_types ? "<dt>논문 유형</dt><dd>" + esc(j.article_types.join(", ")) + "</dd>" : "") +
      (j.conference_link ? "<dt>학회 연계</dt><dd>" + esc(j.conference_link) + "</dd>" : "") + "</dl></section></div>" +
      '<aside class="col-side"><section class="panel"><h2>한눈에</h2><dl class="kv"><dt>적합도</dt><dd>' + stars(j.fit) + "</dd><dt>등급</dt><dd>" + esc(TIER[j.tier]) + "</dd>" +
      (j.issn ? "<dt>ISSN</dt><dd>" + esc(j.issn) + (j.eissn ? " · e " + esc(j.eissn) : "") + "</dd>" : "") +
      "<dt>확인일</dt><dd>" + verified(j) + "</dd></dl></section>" +
      (j.links ? '<section class="panel"><h2>링크</h2>' + linkList(j.links) + "</section>" : "") +
      '<section class="panel"><h2>출처</h2>' + sourceList(j.sources) + "</section></aside></div>";
    main.innerHTML = html;
  }

  /* ================= internships ================= */
  var iState = { types: new Set(), status: "active", degree: "", citizen: false, ctry: "", skill: "", q: "", sort: { key: "fit", dir: -1 } };
  function internships(q) {
    document.title = "인턴십 · Academic Event Radar";
    var view = q.get("view") || "cards";
    page("인턴십", "빅테크부터 로봇 스타트업, 건설 로봇·건설 테크, 연구소까지 — 포지션, 필요한 지식, 급여, 기간, 근무지. 급여는 공고에 적힌 범위가 우선이고, 없으면 levels.fyi 등의 추정치를 출처와 함께 적었습니다.");
    var bar = filtersBar();
    fieldChips(bar, DATA.internships, render);
    var tc = {};
    DATA.internships.forEach(function (i) { tc[i.org_type] = (tc[i.org_type] || 0) + 1; });
    chipSet(bar, "유형", Object.keys(ORG_TYPE).filter(function (k) { return tc[k]; }).map(function (k) { return { value: k, label: ORG_TYPE[k], count: tc[k] }; }), iState.types, render);
    selectBox(bar, "상태", [{ value: "active", label: "모집 중·상시·예정" }, { value: "open", label: "모집 중만" }, { value: "all", label: "마감 포함 전체" }], iState.status, function (v) { iState.status = v; render(); });
    selectBox(bar, "학위", [{ value: "", label: "전체" }, { value: "phd", label: "PhD" }, { value: "ms", label: "MS" }], iState.degree, function (v) { iState.degree = v; render(); });
    var ctrs = {};
    DATA.internships.forEach(function (i) { (i.locations || []).forEach(function (l) { ctrs[l.country] = 1; }); });
    selectBox(bar, "국가", [{ value: "", label: "전체" }].concat(Object.keys(ctrs).sort().map(function (c) { return { value: c, label: flag(c) + " " + country(c) }; })), iState.ctry, function (v) { iState.ctry = v; render(); });
    toggleBox(bar, "시민권 요건 없는 공고만", iState.citizen, function (v) { iState.citizen = v; render(); });
    searchBox(bar, "회사·포지션·스킬 검색", iState.q, function (v) { iState.q = v; render(); });
    var count = tabs("internships", [
      { key: "cards", label: "카드" }, { key: "table", label: "표" }, { key: "pay", label: "급여 비교" }, { key: "skills", label: "요구 스킬" },
      { key: "map", label: "근무지 지도" }, { key: "auto", label: "자동 수집 " + (DATA.auto_jobs || []).length },
    ], view);
    var out = node("<div></div>");
    main.appendChild(out);
    render();

    function items() {
      return DATA.internships.filter(function (i) {
        var st = internStatus(i);
        return matchFields(i) && (!iState.types.size || iState.types.has(i.org_type)) &&
          (iState.status === "all" || (iState.status === "open" ? st === "open" : st !== "closed")) &&
          (!iState.degree || (i.degree || []).indexOf(iState.degree) >= 0) &&
          (!iState.ctry || (i.locations || []).some(function (l) { return l.country === iState.ctry; })) &&
          (!iState.citizen || i.citizenship === "none") &&
          (!iState.skill || (i.skills || []).indexOf(iState.skill) >= 0) &&
          matchText(i, iState.q, ["company", "title", "team", "skills", "required", "preferred"]);
      });
    }
    function render() {
      Charts.reset();
      var list = items();
      count.innerHTML = list.length + "개 공고" + (iState.skill ? ' · 스킬 <button type="button" class="chip" aria-pressed="true" id="clear-skill">' + esc(iState.skill) + " ✕</button>" : "");
      var cs = document.getElementById("clear-skill");
      if (cs) cs.addEventListener("click", function () { iState.skill = ""; render(); });
      out.replaceChildren();
      if (view === "auto") return autoJobs(out);
      if (!list.length) { out.innerHTML = empty(); return; }
      ({ cards: internCards, table: internTable, pay: internPay, skills: internSkills, map: internMap }[view] || internCards)(out, list, render, function (sk) {
        iState.skill = sk;
        location.hash = "#/internships";
      });
    }
  }
  function sortInterns(list) {
    return list.slice().sort(function (a, b) {
      var sa = internStatus(a) === "closed" ? 1 : 0, sb = internStatus(b) === "closed" ? 1 : 0;
      return sa - sb || b.fit - a.fit || (b.posted || "").localeCompare(a.posted || "");
    });
  }
  function internCards(out, list, rerender, setSkill) {
    out.innerHTML = '<div class="cards">' + sortInterns(list).map(function (i) {
      var st = internStatus(i), loc = (i.locations || []).slice(0, 2).map(place).join("<br>") + ((i.locations || []).length > 2 ? ' <span class="muted">외 ' + (i.locations.length - 2) + "곳</span>" : "");
      return '<article class="card' + (st === "closed" ? " dim" : "") + '"><div class="top"><div class="grow"><div class="eyebrow">' + catLabel("internships") + "<span>" + esc(ORG_TYPE[i.org_type]) + "</span>" +
        (i.team ? "<span>· " + esc(i.team) + "</span>" : "") + "</div>" +
        '<h3><a href="#/internships/' + esc(i.id) + '">' + esc(i.company) + " — " + esc(i.title) + "</a></h3></div>" + stars(i.fit) + "</div>" +
        '<dl class="meta"><dt>근무지</dt><dd>' + loc + (i.work_mode && i.work_mode !== "onsite" ? ' <span class="muted">· ' + esc(MODE[i.work_mode]) + "</span>" : "") + "</dd>" +
        "<dt>기간</dt><dd>" + esc(i.season) + (i.duration ? " · " + esc(i.duration) : "") + "</dd>" +
        "<dt>급여</dt><dd>" + (i.pay ? esc(payText(i.pay)) + ' <span class="muted">' + esc(payMonthly(i.pay)) + (i.pay.source !== "posting" ? " · 추정(" + esc(i.pay.source) + ")" : "") + "</span>" : '<span class="faint">미공개</span>') + "</dd>" +
        "<dt>학위</dt><dd>" + esc((i.degree || []).map(function (x) { return x.toUpperCase(); }).join(" · ")) + (i.citizenship && i.citizenship !== "none" ? ' · <span class="muted">' + esc(CITIZEN[i.citizenship]) + "</span>" : "") + "</dd></dl>" +
        '<div class="tags">' + (i.skills || []).slice(0, 8).map(function (s) { return '<button type="button" class="tag" data-skill="' + esc(s) + '">' + esc(s) + "</button>"; }).join("") + "</div>" +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + statusBadge(st) +
        (i.deadline ? '<span class="small">마감 ' + fmtDate(i.deadline) + " " + dday(i.deadline) + "</span>" : i.posted ? '<span class="small muted">게시 ' + fmtDate(i.posted) + "</span>" : "") + "</div>" +
        '<p class="take">' + esc(i.take) + "</p></article>";
    }).join("") + "</div>";
    out.querySelectorAll("[data-skill]").forEach(function (b) { b.addEventListener("click", function () { setSkill(b.getAttribute("data-skill")); iStateRender(rerender); }); });
  }
  function iStateRender(rerender) { rerender(); }
  function internTable(out, list, rerender) {
    var cols = [
      { key: "company", label: "회사 · 포지션", cls: "name", sort: function (i) { return i.company.toLowerCase(); },
        render: function (i) { return '<a href="#/internships/' + esc(i.id) + '">' + esc(i.company) + "</a><small>" + esc(i.title) + "</small>"; } },
      { key: "type", label: "유형", sort: function (i) { return ORG_TYPE[i.org_type]; }, render: function (i) { return esc(ORG_TYPE[i.org_type]); } },
      { key: "loc", label: "근무지", render: function (i) { return (i.locations || []).slice(0, 2).map(place).join("<br>"); } },
      { key: "season", label: "시기·기간", render: function (i) { return esc(i.season) + (i.duration ? '<br><small class="muted">' + esc(i.duration) + "</small>" : ""); } },
      { key: "pay", label: "급여 (월 환산)", num: true, desc: true, sort: function (i) { return i.pay && i.pay.usd_month ? i.pay.usd_month[1] : null; },
        render: function (i) { return i.pay ? esc(payMonthly(i.pay).replace("≈ ", "")) + '<br><small class="muted">' + esc(payText(i.pay)) + "</small>" : '<span class="faint">미공개</span>'; } },
      { key: "status", label: "상태", sort: function (i) { return internStatus(i); }, render: function (i) { return statusBadge(internStatus(i)) + (i.deadline ? "<br>" + dday(i.deadline) : ""); } },
      { key: "fit", label: "적합도", desc: true, sort: function (i) { return i.fit; }, render: function (i) { return stars(i.fit); } },
    ];
    sortableTable(out, cols, list, iState, rerender, function (i) { return internStatus(i) === "closed" ? "dim" : ""; });
  }
  function niceMax(v, step) { return Math.max(step, Math.ceil(v / step) * step); }
  function internPay(out, list) {
    var withPay = list.filter(function (i) { return i.pay && i.pay.usd_month; });
    var groups = Object.keys(ORG_TYPE).map(function (k) {
      return { label: ORG_TYPE[k], items: withPay.filter(function (i) { return i.org_type === k; }).sort(function (a, b) { return b.pay.usd_month[1] - a.pay.usd_month[1]; }).map(function (i) {
        return { label: i.company + " · " + i.title, lo: i.pay.usd_month[0], hi: i.pay.usd_month[1], emphasis: i.fit === 3, color: "var(--intern)", href: "#/internships/" + i.id,
          tip: { title: i.company + " — " + i.title, rows: [{ value: payText(i.pay), label: i.pay.source === "posting" ? "공고 기재" : "추정 · " + i.pay.source }, { value: payMonthly(i.pay), label: "월 환산 (USD)" }], note: i.pay.note || "" } };
      }) };
    }).filter(function (g) { return g.items.length; });
    var maxV = Math.max.apply(null, withPay.map(function (i) { return i.pay.usd_month[1]; }).concat([1000]));
    var step = maxV > 16000 ? 4000 : 2000, max = niceMax(maxV, step), ticks = [];
    for (var t = 0; t <= max; t += step) ticks.push(t);
    Charts.figure(out, {
      title: "급여 범위 — 월 환산 (USD)",
      subtitle: "시급은 주 40시간 × 52주 ÷ 12로 월 환산, 외화는 " + esc(DATA.meta.fx.date) + " 환율. 주황 = 적합도 ★★★. 막대 양 끝이 공고의 최저·최고.",
      legend: [{ label: "적합도 ★★★", color: "var(--intern)" }, { label: "그 외", color: "var(--deemph)" }],
      draw: function (div, w) { Charts.ranges(div, w, groups, { max: max, ticks: ticks, fmt: function (v) { return v === 0 ? "$0" : "$" + v / 1000 + "k"; }, aria: "인턴십 급여 범위" }); },
      table: function () {
        return { head: ["회사", "포지션", "급여(원문)", "월 환산 USD", "출처"], rows: withPay.map(function (i) { return [i.company, i.title, payText(i.pay), payMonthly(i.pay), i.pay.source]; }) };
      },
    });
    var none = list.length - withPay.length;
    if (none) out.insertAdjacentHTML("beforeend", '<p class="muted small" style="margin-top:10px">급여를 공개하지 않은 공고 ' + none + "건은 빠져 있습니다.</p>");
  }
  function internSkills(out, list, rerender, setSkill) {
    var counts = {};
    list.forEach(function (i) { (i.skills || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; }); });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).slice(0, 24);
    Charts.figure(out, {
      title: "공고가 요구하는 스킬",
      subtitle: "현재 필터의 공고 " + list.length + "건에서 각 스킬이 나온 횟수. 막대를 누르면 그 스킬을 요구하는 공고만 봅니다.",
      draw: function (div, w) {
        Charts.hbar(div, w, top.map(function (s) {
          return { label: s, value: counts[s], valueLabel: counts[s] + "건", emphasis: true, color: "var(--intern)", href: "#/internships",
            tip: { title: s, rows: [{ value: counts[s] + "건", label: "/ " + list.length + "건 중" }], note: "누르면 이 스킬로 필터" } };
        }), { aria: "요구 스킬 막대 그래프", labelW: 170, rowH: 22 });
        div.querySelectorAll("rect.hit").forEach(function (r, idx) { r.addEventListener("click", function () { setSkill(top[idx]); }); });
      },
      table: function () { return { head: ["스킬", "공고 수"], numeric: [false, true], rows: top.map(function (s) { return [s, String(counts[s])]; }) }; },
    });
    var links = DATA.skill_links || {};
    var study = top.filter(function (s) { return links[s]; });
    if (study.length) out.insertAdjacentHTML("beforeend", '<section class="section"><h2>위키에서 공부하기 <span class="muted">많이 요구되는 스킬 → Physical AI Notes의 해당 페이지</span></h2>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">스킬</th><th scope="col" class="num">공고 수</th><th scope="col">위키 페이지</th></tr></thead><tbody>' +
      study.map(function (s) {
        return '<tr><td><span class="tag">' + esc(s) + '</span></td><td class="num">' + counts[s] + '</td><td><a href="' + esc(links[s].url) + '" target="_blank" rel="noopener">' + esc(links[s].label) + " ↗</a></td></tr>";
      }).join("") + "</tbody></table></div></section>");
  }
  function internMap(out, list) {
    var byCity = {}, hosts = {};
    list.forEach(function (i) {
      (i.locations || []).forEach(function (l) {
        hosts[l.country] = true;
        if (typeof l.lat !== "number") return;
        var k = l.lat.toFixed(0) + "," + l.lon.toFixed(0);
        var g = byCity[k] || (byCity[k] = { lat: l.lat, lon: l.lon, city: l.city, country: l.country, list: [] });
        if (g.list.indexOf(i) < 0) g.list.push(i);
      });
    });
    var points = Object.keys(byCity).map(function (k) {
      var g = byCity[k];
      return { lat: g.lat, lon: g.lon, n: g.list.length, color: "var(--intern)", label: g.city + " " + g.list.length,
        tip: { title: flag(g.country) + " " + g.city + ", " + country(g.country), rows: g.list.slice(0, 12).map(function (i) { return { value: i.company, label: i.title }; }), note: g.list.length > 12 ? "외 " + (g.list.length - 12) + "건" : "" } };
    });
    Charts.figure(out, {
      title: "근무지",
      subtitle: "공고의 근무 도시(여러 곳이면 모두). 점이 클수록 공고가 많습니다. 가까운 도시는 하나로 묶었습니다.",
      draw: function (div, w) { Charts.worldMap(div, w, hosts, points, { hostClass: "intern", aria: "인턴십 근무지 지도" }); },
      table: function () {
        return { head: ["도시", "국가", "공고 수", "회사"], numeric: [false, false, true, false], rows: Object.keys(byCity).map(function (k) { var g = byCity[k]; return [g.city, country(g.country), String(g.list.length), g.list.map(function (i) { return i.company; }).join(", ")]; }) };
      },
    });
  }
  function autoJobs(out) {
    var list = (DATA.auto_jobs || []).filter(function (p) { return matchText(p, iState.q, ["company", "title", "location"]); });
    var when = DATA.meta.jobs_collected_at ? fmtDate(DATA.meta.jobs_collected_at.slice(0, 10)) : "";
    var html = '<p class="muted">수집기가 매일 회사 채용 시스템(Greenhouse·Lever·Ashby·Workday 등)에서 인턴 + 로보틱스/비전/건설 키워드로 찾은 원본 목록입니다. ' +
      "리서치 에이전트가 매주 검토해 관련 있는 공고를 위 카드로 옮깁니다." + (when ? " 마지막 수집 " + esc(when) + "." : "") + "</p>";
    if (!list.length) { out.innerHTML = html + empty("아직 자동 수집된 새 공고가 없습니다."); return; }
    html += '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">회사</th><th scope="col">공고</th><th scope="col">근무지</th><th scope="col">게시</th><th scope="col">급여</th></tr></thead><tbody>' +
      list.map(function (p) {
        return '<tr><td class="nowrap">' + esc(p.company) + '</td><td><a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.title) + "</a>" +
          (p.matched ? '<br><small class="muted">' + esc(p.matched.join(", ")) + "</small>" : "") + "</td><td>" + esc(p.location || "") + '</td><td class="nowrap">' + (p.posted ? fmtDate(p.posted) : "") +
          "</td><td>" + esc(p.pay || "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    out.innerHTML = html;
  }
  function internDetail(q, id) {
    var i = findItem("internships", id);
    if (!i) return notFound();
    document.title = i.company + " · 인턴십 · Academic Event Radar";
    var st = internStatus(i);
    function list(arr) { return arr && arr.length ? "<ul>" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : '<p class="faint">공고에 없음</p>'; }
    var html = '<div class="crumbs"><a href="#/internships">인턴십</a> / ' + esc(i.company) + "</div>" +
      '<div class="detail-head"><div class="grow"><div class="eyebrow">' + catLabel("internships") + "<span>" + esc(ORG_TYPE[i.org_type]) + "</span>" + statusBadge(st) + fieldTags(i.fields) + "</div>" +
      "<h1>" + esc(i.title) + '</h1><div class="full"><b>' + esc(i.company) + "</b>" + (i.team ? ' <span class="muted">· ' + esc(i.team) + "</span>" : "") + "</div></div>" +
      '<div class="detail-actions"><a class="btn primary" href="' + esc(i.apply_url) + '" target="_blank" rel="noopener">공고 보기 · 지원 ↗</a></div></div>' +
      '<div class="take-box"><b>한 줄 평</b>' + esc(i.take) + "</div>" +
      '<div class="detail"><div class="col-main">' +
      '<section class="panel"><h2>하는 일</h2>' + list(i.responsibilities) + "</section>" +
      '<section class="panel"><h2>필요한 지식</h2><h3>필수</h3>' + list(i.required) + '<h3 style="margin-top:10px">우대</h3>' + list(i.preferred) +
      '<h3 style="margin-top:10px">스킬 태그</h3><div class="tags">' + (i.skills || []).map(function (s) {
        var l = (DATA.skill_links || {})[s];
        return l ? '<a class="tag" href="' + esc(l.url) + '" target="_blank" rel="noopener" title="위키: ' + esc(l.label) + '">' + esc(s) + " ↗</a>" : '<span class="tag">' + esc(s) + "</span>";
      }).join("") + '</div><p class="small muted" style="margin:6px 0 0">↗ 표시 태그는 <a href="https://jiseop-byeon.github.io/phd-wiki/" target="_blank" rel="noopener">Physical AI Notes</a>의 해당 학습 페이지로 연결됩니다.</p></section>' +
      '<section class="panel"><h2>조건</h2><dl class="kv">' +
      "<dt>근무지</dt><dd>" + (i.locations || []).map(place).join("<br>") + "</dd>" +
      "<dt>근무 형태</dt><dd>" + esc(MODE[i.work_mode] || i.work_mode) + "</dd>" +
      "<dt>시기</dt><dd>" + esc(i.season) + (i.start ? " · 시작 " + esc(i.start === "flexible" ? "협의" : i.start.replace("-", ".")) : "") + "</dd>" +
      (i.duration ? "<dt>기간</dt><dd>" + esc(i.duration) + "</dd>" : "") +
      "<dt>급여</dt><dd>" + (i.pay ? esc(payText(i.pay)) + ' <span class="muted">' + esc(payMonthly(i.pay)) + "</span><br><small class=\"muted\">" + (i.pay.source === "posting" ? "공고 기재" : "추정 · " + esc(i.pay.source)) + (i.pay.note ? " · " + esc(i.pay.note) : "") + "</small>" : '<span class="faint">미공개</span>') + "</dd>" +
      "<dt>학위</dt><dd>" + esc((i.degree || []).map(function (x) { return x.toUpperCase(); }).join(" · ")) + "</dd>" +
      "<dt>자격</dt><dd>" + esc(CITIZEN[i.citizenship] || "") + (i.eligibility_note ? '<br><span class="muted">' + esc(i.eligibility_note) + "</span>" : "") + "</dd>" +
      (i.posted ? "<dt>게시일</dt><dd>" + fmtDate(i.posted) + "</dd>" : "") +
      (i.deadline ? "<dt>마감</dt><dd>" + fmtDate(i.deadline, true) + " " + dday(i.deadline) + "</dd>" : "") + "</dl></section></div>" +
      '<aside class="col-side"><section class="panel"><h2>한눈에</h2><dl class="kv"><dt>적합도</dt><dd>' + stars(i.fit) + "</dd><dt>상태</dt><dd>" + statusBadge(st) + "</dd><dt>확인일</dt><dd>" + verified(i) + "</dd></dl></section>" +
      '<section class="panel"><h2>출처</h2>' + sourceList(i.sources) + "</section></aside></div>";
    main.innerHTML = html;
  }

  /* ================= scholarships ================= */
  var sState = { orgs: new Set(), types: new Set(), korean: false, intl: false, noNom: false, status: "active", q: "", sort: { key: "next", dir: 1 } };
  function scholarships(q) {
    document.title = "장학금 · Academic Event Radar";
    var view = q.get("view") || "cards";
    page("장학금", "한국 재단·정부, 기업 펠로십, 학회 여행 지원까지 — 금액, 자격, 준비 서류, 주최, 마감. 적합도는 미국 대학의 한국인 박사과정생(건설·로보틱스) 기준입니다.");
    var bar = filtersBar();
    var oc = {}, tc = {};
    DATA.scholarships.forEach(function (s) { oc[s.org_type] = (oc[s.org_type] || 0) + 1; tc[s.type] = (tc[s.type] || 0) + 1; });
    chipSet(bar, "주최", Object.keys(SCH_ORG).filter(function (k) { return oc[k]; }).map(function (k) { return { value: k, label: SCH_ORG[k], count: oc[k] }; }), sState.orgs, render);
    chipSet(bar, "종류", Object.keys(SCH_TYPE).filter(function (k) { return tc[k]; }).map(function (k) { return { value: k, label: SCH_TYPE[k], count: tc[k] }; }), sState.types, render);
    toggleBox(bar, "한국 국적 지원 가능", sState.korean, function (v) { sState.korean = v; render(); });
    toggleBox(bar, "미국 대학 유학생 지원 가능", sState.intl, function (v) { sState.intl = v; render(); });
    toggleBox(bar, "대학 추천 불필요", sState.noNom, function (v) { sState.noNom = v; render(); });
    selectBox(bar, "상태", [{ value: "active", label: "지원 가능(모집 중·예정)" }, { value: "all", label: "마감 포함 전체" }], sState.status, function (v) { sState.status = v; render(); });
    searchBox(bar, "장학금·주최 검색", sState.q, function (v) { sState.q = v; render(); });
    var count = tabs("scholarships", [{ key: "cards", label: "카드" }, { key: "table", label: "표" }, { key: "timeline", label: "일정·금액" }, { key: "matrix", label: "자격 매트릭스" }], view);
    var out = node("<div></div>");
    main.appendChild(out);
    render();
    function render() {
      Charts.reset();
      var list = DATA.scholarships.filter(function (s) {
        var e = s.eligibility || {}, st = scholInfo(s).status;
        return (!sState.orgs.size || sState.orgs.has(s.org_type)) && (!sState.types.size || sState.types.has(s.type)) &&
          (!sState.korean || e.korean_ok) && (!sState.intl || e.international_in_us_ok) && (!sState.noNom || !s.nomination) &&
          (sState.status === "all" || st !== "closed") && matchText(s, sState.q, ["name", "organizer"]);
      });
      count.textContent = list.length + "개";
      out.replaceChildren();
      if (!list.length) { out.innerHTML = empty(); return; }
      ({ cards: scholCards, table: scholTable, timeline: scholTimeline, matrix: scholMatrix }[view] || scholCards)(out, list, render);
    }
  }
  function amountText(a) {
    var s = esc(a.summary || "");
    if (a.usd && a.currency !== "USD") s += ' <span class="muted">(≈ ' + usdK(a.usd) + (a.usd_max && a.usd_max !== a.usd ? "–" + usdK(a.usd_max) : "") + (a.usd_unit === "year" ? "/년" : "") + ")</span>";
    return s;
  }
  function eligBadges(s) {
    var e = s.eligibility || {}, out = [];
    out.push('<span class="badge' + (e.korean_ok ? " open" : " closed") + '"><i class="ico"></i>' + (e.korean_ok ? "한국 국적 가능" : "한국 국적 불가") + "</span>");
    out.push('<span class="badge' + (e.international_in_us_ok ? " open" : " closed") + '"><i class="ico"></i>' + (e.international_in_us_ok ? "미국 유학생 가능" : "미국 유학생 불가") + "</span>");
    if (e.us_citizen_only) out.push('<span class="badge closed"><i class="ico"></i>미국 시민권자만</span>');
    if (s.nomination) out.push('<span class="badge"><i class="ico"></i>대학 추천 필요</span>');
    return '<span class="tags">' + out.join("") + "</span>";
  }
  function nextLine(s) {
    var n = scholInfo(s).next;
    if (!n) return '<span class="faint">이번 주기 마감 · ' + esc(((s.cycle || {}).typical) || "다음 공고 대기") + "</span>";
    return '<span class="nowrap">' + fmtDate(n.date) + "</span> " + dday(n.date, n.estimated) + ' <small class="muted">' + esc(n.label || KIND[n.kind]) + "</small>";
  }
  function scholCards(out, list) {
    var sorted = list.slice().sort(function (a, b) {
      var x = scholInfo(a).next, y = scholInfo(b).next;
      return (x ? d(x.date) : 9e15) - (y ? d(y.date) : 9e15) || b.fit - a.fit;
    });
    out.innerHTML = '<div class="cards">' + sorted.map(function (s) {
      var st = scholInfo(s).status;
      return '<article class="card' + (st === "closed" ? " dim" : "") + '"><div class="top"><div class="grow"><div class="eyebrow">' + catLabel("scholarships") +
        "<span>" + esc(SCH_ORG[s.org_type]) + " · " + esc(SCH_TYPE[s.type]) + "</span></div>" +
        '<h3><a href="#/scholarships/' + esc(s.id) + '">' + esc(s.name) + '</a></h3><div class="small muted">' + esc(s.organizer) + "</div></div>" + stars(s.fit) + "</div>" +
        '<dl class="meta"><dt>금액</dt><dd>' + amountText(s.amount) + "</dd>" +
        (s.duration ? "<dt>기간</dt><dd>" + esc(s.duration) + "</dd>" : "") +
        "<dt>다음 마감</dt><dd>" + nextLine(s) + "</dd>" +
        (s.eligibility && s.eligibility.stage ? "<dt>단계</dt><dd>" + esc(s.eligibility.stage) + "</dd>" : "") + "</dl>" +
        eligBadges(s) + '<div style="display:flex;gap:8px;align-items:center">' + statusBadge(st) + "</div>" +
        '<p class="take">' + esc(s.take) + "</p></article>";
    }).join("") + "</div>";
  }
  function scholTable(out, list, rerender) {
    var cols = [
      { key: "name", label: "장학금", cls: "name", sort: function (s) { return s.name.toLowerCase(); },
        render: function (s) { return '<a href="#/scholarships/' + esc(s.id) + '">' + esc(s.name) + "</a><small>" + esc(s.organizer) + "</small>"; } },
      { key: "type", label: "종류", sort: function (s) { return SCH_TYPE[s.type]; }, render: function (s) { return esc(SCH_ORG[s.org_type]) + '<br><small class="muted">' + esc(SCH_TYPE[s.type]) + "</small>"; } },
      { key: "amount", label: "금액", desc: true, sort: function (s) { return s.amount.usd_max || s.amount.usd || null; }, render: function (s) { return amountText(s.amount); } },
      { key: "next", label: "다음 마감", sort: function (s) { var n = scholInfo(s).next; return n ? n.date : null; }, render: nextLine },
      { key: "elig", label: "자격", render: eligBadges },
      { key: "fit", label: "적합도", desc: true, sort: function (s) { return s.fit; }, render: function (s) { return stars(s.fit); } },
    ];
    sortableTable(out, cols, list, sState, rerender, function (s) { return scholInfo(s).status === "closed" ? "dim" : ""; });
  }
  function scholTimeline(out, list) {
    var start = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1), end = new Date(TODAY.getFullYear(), TODAY.getMonth() + 13, 0);
    var rows = list.filter(function (s) { return scholInfo(s).dls.length; }).sort(function (a, b) {
      var x = scholInfo(a).next, y = scholInfo(b).next;
      return (x ? d(x.date) : 9e15) - (y ? d(y.date) : 9e15);
    }).map(function (s) {
      var marks = scholInfo(s).dls.map(function (x) {
        return { type: x.kind === "application" ? "deadline" : x.kind === "result" ? "ring" : "minor", date: x.date, est: x.estimated };
      });
      return { label: shortName(s.name), href: "#/scholarships/" + s.id, emphasis: s.fit === 3, color: "var(--schol)", marks: marks,
        tip: { title: s.name, rows: scholInfo(s).dls.map(function (x) { return { value: fmtDate(x.date) + (x.estimated ? " ≈" : ""), label: x.label || KIND[x.kind] }; }), note: s.take } };
    });
    Charts.figure(out, {
      title: "마감 일정",
      subtitle: "다음 마감이 가까운 순. 청록 = 적합도 ★★★. 작은 점 = 학내 추천·추천서 마감, 빈 원 = 결과 발표, 점선 = 추정.",
      legend: [{ label: "지원 마감", color: "var(--schol)" }, { label: "학내 추천 등", color: "var(--schol)", shape: "small" }, { label: "결과 발표", color: "var(--schol)", shape: "ring" }],
      scroll: true, minWidth: 720,
      draw: function (div, w) { Charts.timeline(div, w, rows, { start: start, end: end, today: TODAY, labelW: 190, aria: "장학금 마감 타임라인" }); },
      table: function () { return { head: ["장학금", "일정"], rows: rows.map(function (r) { return [r.label, r.tip.rows.map(function (x) { return x.label + " " + x.value; }).join(" · ")]; }) }; },
    });
    var yearly = list.filter(function (s) { return s.amount.usd && s.amount.usd_unit === "year"; }).sort(function (a, b) { return (b.amount.usd_max || b.amount.usd) - (a.amount.usd_max || a.amount.usd); });
    if (yearly.length) {
      Charts.figure(out, {
        title: "연간 지원 규모 (USD 환산)",
        subtitle: "연 단위로 주는 장학금만. 학비 면제처럼 금액이 학교마다 다른 부분은 빠질 수 있어, 상세 페이지의 설명을 함께 보세요.",
        draw: function (div, w) {
          Charts.hbar(div, w, yearly.map(function (s) {
            var v = s.amount.usd_max || s.amount.usd;
            return { label: shortName(s.name), value: v, valueLabel: money(v, "USD") + (s.amount.usd_max && s.amount.usd_max !== s.amount.usd ? " (최대)" : ""), emphasis: s.fit === 3, color: "var(--schol)", href: "#/scholarships/" + s.id,
              tip: { title: s.name, rows: [{ value: money(v, "USD") + "/년", label: "USD 환산" }], note: s.amount.summary } };
          }), { aria: "연간 지원 규모", labelW: 190 });
        },
        table: function () { return { head: ["장학금", "연간 USD", "원문"], rows: yearly.map(function (s) { return [s.name, money(s.amount.usd_max || s.amount.usd, "USD"), s.amount.summary]; }) }; },
      });
    }
  }
  function scholMatrix(out, list) {
    function yes(v) { return v ? '<span title="가능">✓ <span class="sr">가능</span></span>' : '<span class="faint" title="불가">✕ <span class="sr">불가</span></span>'; }
    out.innerHTML = '<p class="muted">한눈에 거르기: 한국 국적, 미국 대학에 재학 중인 비시민권자, 시민권 요건, 대학 추천 필요 여부.</p>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">장학금</th><th scope="col">한국 국적</th><th scope="col">미국 유학생</th><th scope="col">시민권 불필요</th><th scope="col">추천 불필요</th><th scope="col">학위 단계</th><th scope="col">다음 마감</th></tr></thead><tbody>' +
      list.slice().sort(function (a, b) { return b.fit - a.fit; }).map(function (s) {
        var e = s.eligibility || {};
        return '<tr><td class="name"><a href="#/scholarships/' + esc(s.id) + '">' + esc(shortName(s.name)) + "</a><small>" + esc(s.organizer) + "</small></td>" +
          "<td>" + yes(e.korean_ok) + "</td><td>" + yes(e.international_in_us_ok) + "</td><td>" + yes(!e.us_citizen_only) + "</td><td>" + yes(!s.nomination) + "</td>" +
          '<td class="small">' + esc(e.stage || "") + "</td><td>" + nextLine(s) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function scholDetail(q, id) {
    var s = findItem("scholarships", id);
    if (!s) return notFound();
    document.title = shortName(s.name) + " · 장학금 · Academic Event Radar";
    var info = scholInfo(s), e = s.eligibility || {}, a = s.amount || {};
    var html = '<div class="crumbs"><a href="#/scholarships">장학금</a> / ' + esc(shortName(s.name)) + "</div>" +
      '<div class="detail-head"><div class="grow"><div class="eyebrow">' + catLabel("scholarships") + "<span>" + esc(SCH_ORG[s.org_type]) + " · " + esc(SCH_TYPE[s.type]) + "</span>" + statusBadge(info.status) + "</div>" +
      "<h1>" + esc(s.name) + '</h1><div class="full">' + esc(s.organizer) + "</div></div>" +
      '<div class="detail-actions">' + (s.apply_url ? '<a class="btn primary" href="' + esc(s.apply_url) + '" target="_blank" rel="noopener">지원 페이지 ↗</a>' : "") + "</div></div>" +
      '<div class="take-box"><b>한 줄 평</b>' + esc(s.take) + "</div>" +
      '<div class="detail"><div class="col-main">' +
      '<section class="panel"><h2>일정</h2><div class="chart dl-timeline" id="sch-strip"></div>' +
      (info.dls.length ? '<div class="table-wrap" style="margin-top:6px"><table class="data"><thead><tr><th scope="col">구분</th><th scope="col">날짜</th><th scope="col">남은 기간</th></tr></thead><tbody>' +
        info.dls.map(function (x) { return "<tr><td>" + esc(x.label || KIND[x.kind]) + '</td><td class="nowrap">' + fmtDate(x.date, true) + (x.tz ? " " + esc(x.tz) : "") + "</td><td>" + dday(x.date, x.estimated) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : "") +
      ((s.cycle || {}).typical ? '<p class="muted small" style="margin-top:8px">보통 주기: ' + esc(s.cycle.typical) + "</p>" : "") + "</section>" +
      '<section class="panel"><h2>금액</h2><dl class="kv"><dt>지원 내용</dt><dd>' + amountText(a) + "</dd>" +
      (a.covers ? "<dt>포함</dt><dd>" + esc(a.covers.join(", ")) + "</dd>" : "") +
      (s.duration ? "<dt>기간</dt><dd>" + esc(s.duration) + "</dd>" : "") +
      (s.awards_per_year ? "<dt>선발 인원</dt><dd>" + esc(s.awards_per_year) + "</dd>" : "") + "</dl></section>" +
      '<section class="panel"><h2>자격</h2>' + eligBadges(s) + '<dl class="kv" style="margin-top:10px">' +
      (e.nationality ? "<dt>국적</dt><dd>" + esc(e.nationality.map(function (c) { return c === "any" ? "제한 없음" : country(c); }).join(", ")) + "</dd>" : "") +
      (e.where_enrolled ? "<dt>재학 조건</dt><dd>" + esc(e.where_enrolled) + "</dd>" : "") +
      (e.stage ? "<dt>학위 단계</dt><dd>" + esc(e.stage) + "</dd>" : "") +
      (e.notes ? "<dt>메모</dt><dd>" + esc(e.notes) + "</dd>" : "") + "</dl></section>" +
      '<section class="panel"><h2>준비 서류</h2>' + ((s.requirements || []).length ? "<ul>" + s.requirements.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : '<p class="faint">공고 확인 필요</p>') + "</section></div>" +
      '<aside class="col-side"><section class="panel"><h2>한눈에</h2><dl class="kv"><dt>적합도</dt><dd>' + stars(s.fit) + "</dd>" +
      "<dt>대학 추천</dt><dd>" + (s.nomination ? "필요" : "불필요") + "</dd><dt>분야</dt><dd>" + fieldTags(s.fields) + "</dd><dt>확인일</dt><dd>" + verified(s) + "</dd></dl></section>" +
      (s.links ? '<section class="panel"><h2>링크</h2>' + linkList(s.links) + "</section>" : "") +
      '<section class="panel"><h2>출처</h2>' + sourceList(s.sources) + "</section></aside></div>";
    main.innerHTML = html;
    var div = document.getElementById("sch-strip");
    var marks = info.dls.map(function (x) { return { date: x.date, label: x.label || KIND[x.kind], short: fmtDate(x.date).slice(5), type: x.kind === "result" ? "ring" : "dot", est: x.estimated }; });
    if (marks.length >= 1) {
      var drawIt = function () { div.replaceChildren(); Charts.deadlineStrip(div, div.clientWidth || 600, marks, { today: TODAY, color: "var(--schol)" }); };
      drawIt();
      window.addEventListener("resize", debounce(drawIt, 150));
    } else div.remove();
  }

  /* ================= calendar ================= */
  var calState = { month: null, cats: new Set(["conferences", "internships", "scholarships"]), all: false };
  function calendar(q) {
    document.title = "캘린더 · Academic Event Radar";
    page("캘린더", "모든 마감을 한 달 단위로. 구독하면 휴대폰·구글 캘린더에 자동으로 들어오고, 사이트가 갱신될 때 함께 바뀝니다.");
    var base = DATA.meta.site_url.replace(/^https:/, "");
    var ics = DATA.meta.site_url + "deadlines.ics", icsAll = DATA.meta.site_url + "all-events.ics";
    main.insertAdjacentHTML("beforeend", '<section class="panel" style="margin-bottom:16px"><h2>캘린더 구독</h2><div class="subscribe">' +
      '<a class="btn primary" href="https://calendar.google.com/calendar/r?cid=' + encodeURIComponent("webcal:" + base + "deadlines.ics") + '" target="_blank" rel="noopener">Google 캘린더에 추가</a>' +
      '<a class="btn" href="webcal:' + esc(base) + 'deadlines.ics">Apple·Outlook (webcal)</a>' +
      '<a class="btn" href="deadlines.ics" download>마감 .ics</a><a class="btn" href="all-events.ics" download>전체 일정 .ics</a></div>' +
      '<p class="muted small" style="margin:8px 0 0">마감 캘린더: 논문·초록·지원·학내 추천 마감만. 전체 일정: 결과 발표·최종본·학회 개최까지. 주소 <code class="url">' + esc(ics) + "</code></p></section>");
    var bar = filtersBar();
    fieldChips(bar, DATA.events, draw);
    chipSet(bar, "종류", ["conferences", "internships", "scholarships"].map(function (c) { return { value: c, label: CATS[c].label }; }), calState.cats, draw);
    toggleBox(bar, "결과 발표·개최 등 전체 일정", calState.all, function (v) { calState.all = v; draw(); });
    fitToggle(bar, draw);
    var box = node("<div></div>");
    main.appendChild(box);
    if (!calState.month) calState.month = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    draw();
    function draw() {
      var m = calState.month, y = m.getFullYear(), mo = m.getMonth();
      var first = new Date(y, mo, 1), startDay = new Date(y, mo, 1 - first.getDay());
      var ev = DATA.events.filter(function (e) { return calState.cats.has(e.cat) && matchFields(e) && e.fit >= minFit && (calState.all || ACTION[e.kind]); });
      var byDay = {};
      ev.forEach(function (e) { (byDay[e.date] = byDay[e.date] || []).push(e); });
      var html = '<div class="cal-head"><button type="button" class="btn" data-nav="-1" aria-label="이전 달">←</button><h2>' + y + "년 " + (mo + 1) + '월</h2><button type="button" class="btn" data-nav="1" aria-label="다음 달">→</button>' +
        '<button type="button" class="btn" data-nav="0">오늘</button></div><div class="cal" role="grid">' +
        DOW.split("").map(function (w) { return '<div class="dow" role="columnheader">' + w + "</div>"; }).join("");
      var monthEv = [];
      for (var k = 0; k < 42; k++) {
        var day = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + k);
        if (k >= 35 && day.getMonth() !== mo) break;
        var key = iso(day), list = byDay[key] || [];
        if (day.getMonth() === mo) monthEv = monthEv.concat(list);
        html += '<div class="day' + (day.getMonth() !== mo ? " other" : "") + (key === iso(TODAY) ? " today" : "") + '" role="gridcell"><span class="dnum">' + day.getDate() + "</span>" +
          list.slice(0, 4).map(function (e) {
            var nm = e.cat === "conferences" ? e.name : e.short || shortName(e.name);
            return '<a class="ev cat-' + e.cat + (e.estimated ? " est" : "") + (e.kind === "event" ? " event" : "") + '" href="#/' + e.cat + "/" + esc(e.id) + '" title="' + esc(e.name + " · " + e.label + (e.estimated ? " (추정)" : "")) + '">' + esc(nm + " · " + e.label) + "</a>";
          }).join("") + (list.length > 4 ? '<span class="faint small">+' + (list.length - 4) + "</span>" : "") + "</div>";
      }
      html += "</div>";
      html += '<section class="section"><h2>' + (mo + 1) + '월 일정 <span class="muted">' + monthEv.length + "건</span></h2>" + (monthEv.length ? deadlineList(monthEv) : empty("이 달에는 일정이 없습니다.")) + "</section>";
      box.innerHTML = html;
      box.querySelectorAll("[data-nav]").forEach(function (b) {
        b.addEventListener("click", function () {
          var n = +b.getAttribute("data-nav");
          calState.month = n === 0 ? new Date(TODAY.getFullYear(), TODAY.getMonth(), 1) : new Date(y, mo + n, 1);
          draw();
        });
      });
      var more = box.querySelector(".more-btn");
      if (more) more.addEventListener("click", function () { box.querySelectorAll(".extra").forEach(function (x) { x.hidden = false; }); more.remove(); });
    }
  }

  /* ================= about ================= */
  function about() {
    document.title = "소개 · Academic Event Radar";
    var c = DATA.meta.counts;
    var fresh = [].concat(DATA.conferences, DATA.journals, DATA.internships, DATA.scholarships);
    var f30 = fresh.filter(function (x) { return days(x.last_verified) >= -30; }).length;
    page("이 사이트는 어떻게 만들어지나", "");
    main.insertAdjacentHTML("beforeend", '<div class="prose">' +
      "<p>건설 Physical AI 연구 — 접촉이 많은 조작을 중심으로 내비게이션·HRI·인식 — 에 필요한 학회·저널·인턴십·장학금을 한곳에 모읍니다. " +
      "지금 <b>학회 " + c.conferences + "</b>, <b>저널 " + c.journals + "</b>, <b>인턴십 " + c.internships + "</b>, <b>장학금 " + c.scholarships + "</b>건이 있고, " +
      "그중 " + f30 + "건을 최근 30일 안에 공식 페이지에서 다시 확인했습니다.</p>" +
      "<h2>업데이트 파이프라인</h2>" + pipeline() +
      "<ul><li><b>수집기 (매일, GitHub Actions)</b> — 회사 채용 시스템(Greenhouse·Lever·Ashby·Workday)의 공개 API에서 인턴 + 키워드 공고, 환율, OpenAlex 인용 지표를 가져옵니다. 결과는 인턴십의 ‘자동 수집’ 탭에 그대로 보입니다.</li>" +
      "<li><b>리서치 에이전트 (매주, Claude)</b> — <code>agent/AGENT.md</code>의 절차대로 오래된 항목·지난 마감·새 공고를 공식 페이지에서 확인해 <code>data/*.yaml</code>을 고칩니다. 추정한 날짜는 반드시 추정으로 표시합니다.</li>" +
      "<li><b>검증·빌드</b> — <code>scripts/validate.py</code>가 스키마를 검사하고, 통과한 데이터만 사이트와 캘린더(.ics)로 나갑니다.</li></ul>" +
      "<h2>판단 기준</h2><ul>" +
      "<li><b>적합도 ★1–3</b> — 이 사이트 주인(미국 대학의 한국인 박사과정생, 건설 Physical AI) 기준. ★★★ 직접 목표 · ★★ 관련 있음 · ★ 참고.</li>" +
      "<li><b>성향 −2…+2</b> — 무엇을 기여로 인정하는가. −2 새 알고리즘·이론이 있어야 함(ICML, WAFR) · −1 새 방법 우선(CVPR, CoRL, T-RO) · 0 균형(ICRA, IROS, RA-L) · +1 시스템 통합·실환경 검증 중시(CASE, JFR) · +2 응용·사례로 충분(ISARC, CRC).</li>" +
      "<li><b>등급 Tier 1–3</b> — 자기 커뮤니티 안에서의 위상. 건설 학회의 Tier 1과 ML 학회의 Tier 1은 다른 잣대입니다.</li>" +
      "<li><b>IF·분위</b> — Clarivate JCR(연도 표기)과 SCImago SJR. IF는 분야별 인용 문화 차이가 커서 같은 커뮤니티 안에서만 비교하세요.</li>" +
      "<li><b>급여 월 환산</b> — 시급 × 40시간 × 52주 ÷ 12, 외화는 " + esc(DATA.meta.fx.date) + " 환율. 공고에 없으면 levels.fyi 등 추정치를 출처와 함께 표시합니다.</li></ul>" +
      "<h2>주의</h2><p>날짜와 조건은 바뀝니다. 지원·투고 전에는 반드시 각 항목의 공식 페이지를 직접 확인하세요. ≈ 표시와 점선은 과거 일정으로 추정한 날짜입니다.</p>" +
      '<h2>오류 제보·기여</h2><p>잘못된 정보는 <a href="' + REPO + '/issues/new" target="_blank" rel="noopener">GitHub 이슈</a>로 알려 주세요. 데이터는 <a href="' + REPO + '/tree/main/data" target="_blank" rel="noopener"><code>data/</code></a>의 YAML 한 파일이 한 항목입니다.</p>' +
      '<h2>관련</h2><ul><li><a href="https://jiseop-byeon.github.io/phd-wiki/">Physical AI Notes</a> — 같은 연구 방향의 학습 위키</li><li><a href="https://jiseop-byeon.github.io/">Jiseop Byeon</a></li></ul></div>');
  }
  function pipeline() {
    var steps = [
      ["출처", "학회·저널 공식 페이지<br>채용 시스템 API<br>재단·기업 공고"],
      ["수집기 · 매일", "GitHub Actions<br>채용 ATS · 환율 · OpenAlex"],
      ["리서치 에이전트 · 매주", "Claude · agent/AGENT.md<br>확인 → YAML 수정"],
      ["검증·빌드", "validate.py · build.py<br>스키마 · 추정 표시"],
      ["이 사이트 + 캘린더", "GitHub Pages<br>deadlines.ics"],
    ];
    return '<div class="pipeline" style="display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;margin:6px 0 12px">' + steps.map(function (s, i) {
      return (i ? '<div aria-hidden="true" style="align-self:center;color:var(--faint)">→</div>' : "") +
        '<div class="panel" style="flex:1 1 150px;margin:0"><b style="font-size:0.875rem">' + s[0] + '</b><div class="small muted" style="margin-top:4px">' + s[1] + "</div></div>";
    }).join("") + "</div>";
  }

  /* ================= theme + boot ================= */
  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    var b = document.getElementById("theme-btn");
    if (b) {
      var label = { light: "밝은 테마", dark: "어두운 테마" }[t] || "시스템 테마";
      b.setAttribute("aria-label", "테마: " + label + " (눌러서 바꾸기)");
      b.title = "테마: " + label;
      b.innerHTML = t === "dark" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>'
        : t === "light" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>';
    }
  }
  function boot() {
    var theme = store.get("theme", "auto");
    applyTheme(theme);
    var tb = document.getElementById("theme-btn");
    if (tb) tb.addEventListener("click", function () {
      theme = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
      store.set("theme", theme);
      applyTheme(theme);
      route();
    });
    fetch("data.json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (data) {
      DATA = data;
      data.fields.forEach(function (f) { FIELD[f.key] = f; });
      data.communities.forEach(function (c) { COMM[c.key] = c; });
      var foot = document.getElementById("foot-meta");
      if (foot) foot.textContent = "데이터 빌드 " + fmtDate(data.meta.built_at.slice(0, 10)) + " · 학회 " + data.meta.counts.conferences + " · 저널 " + data.meta.counts.journals +
        " · 인턴십 " + data.meta.counts.internships + " · 장학금 " + data.meta.counts.scholarships;
      route();
    }).catch(function (e) {
      main.innerHTML = '<div class="empty">데이터를 불러오지 못했습니다 (' + esc(e.message) + "). 로컬에서는 <code>python3 scripts/build.py</code> 후 <code>_site/</code>를 서버로 여세요.</div>";
    });
  }
  window.addEventListener("hashchange", route);
  boot();
})();
