(function () {
  'use strict';

  var D = window.DATA || { projects: [], yearly: [], ffg: [] };
  var P = D.projects;
  var INTERNAL = 'Внутренний перечень';
  var FRHC = 'Отчёт FRHC';
  var PLAN = 'План 2026–2027';
  var INTERNAL_PERIODS = ['2023', '2024', '2025', PLAN];
  var FRHC_PERIODS = ['FY2024', 'FY2025', 'FY2026'];
  var NOT_CITY = /^(—|-|Вся страна|Регионы|\d+ город)/;

  // ---------- helpers ----------
  var nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  function mln(v) { return v == null ? '—' : (Math.abs(v) >= 100 ? nf0.format(v) : nf2.format(v)); }
  function bn(v) { return nf2.format(v / 1000); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function isKzt(r) { return r.currency === 'KZT' && typeof r.kzt_mln === 'number'; }
  function sumKzt(rows) {
    var s = 0;
    rows.forEach(function (r) { if (!r.is_part && isKzt(r)) s += r.kzt_mln; });
    return s;
  }
  function uniq(arr) { return Array.from(new Set(arr)).filter(function (x) { return x != null && x !== ''; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
  function acronym(s) {
    return norm(s).replace(/[«»"'().,:;!?—–\-\/]/g, ' ').split(/\s+/).filter(Boolean)
      .map(function (w) { return w[0]; }).join('');
  }
  function isCity(c) { return c && !NOT_CITY.test(c); }
  function splitCities(c) { return String(c || '').split(/,\s*/).filter(isCity); }

  // search index
  P.forEach(function (r) {
    r._hay = norm([r.name, r.alias, r.project, r.tags, r.city, r.country, r.category, r.payer, r.status].join(' '));
    r._acr = [acronym(r.name), acronym(r.project), acronym(r.alias)];
  });

  // ---------- state ----------
  var DEFAULT = { source: 'internal', period: 'fact', q: '', cat: '', country: '', city: '', status: '', fund: false, project: '' };
  var S = Object.assign({}, DEFAULT);
  var sort = { projects: { key: 'sort', dir: -1 }, cities: { key: 'sum', dir: -1 }, multi: { key: 'name', dir: 1 } };
  var tab = 'projects';

  function matchSource(r, src) {
    if (src === 'internal') return r.source_type === INTERNAL;
    if (src === 'frhc') return r.source_type === FRHC;
    return true;
  }
  function matchPeriod(r, per) {
    if (per === 'fact') return r.period_label !== PLAN;
    if (per === 'all') return true;
    return r.period_label === per;
  }
  function matchSearch(r, q) {
    if (!q) return true;
    var nq = norm(q).trim();
    if (!nq) return true;
    return nq.split(/\s+/).every(function (t) {
      if (r._hay.indexOf(t) >= 0) return true;
      return t.length >= 2 && r._acr.some(function (a) { return a.indexOf(t) >= 0; });
    });
  }
  // except: list of filter names to ignore
  function filtered(except) {
    except = except || [];
    var ign = function (k) { return except.indexOf(k) >= 0; };
    return P.filter(function (r) {
      if (S.project && !ign('project')) {
        // project mode: all records of this project from both sources, all years
        if (r.project !== S.project) return false;
      } else {
        if (!ign('source') && !matchSource(r, S.source)) return false;
        if (!ign('period') && !matchPeriod(r, S.period)) return false;
      }
      if (!ign('q') && !matchSearch(r, S.q)) return false;
      if (!ign('cat') && S.cat && r.category !== S.cat) return false;
      if (!ign('country') && S.country && r.country !== S.country) return false;
      if (!ign('city') && S.city && splitCities(r.city).concat([r.city]).indexOf(S.city) < 0) return false;
      if (!ign('status') && S.status && r.status !== S.status) return false;
      if (!ign('fund') && S.fund && !r.is_fund) return false;
      return true;
    });
  }

  // ---------- tooltip ----------
  var tip = $('tip');
  function showTip(e, html) {
    tip.innerHTML = html; tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var x = Math.min(e.clientX + 12, window.innerWidth - w - 8);
    var y = e.clientY + 14 + h > window.innerHeight ? e.clientY - h - 10 : e.clientY + 14;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { tip.hidden = true; }
  function bindTip(el, html) {
    el.addEventListener('mousemove', function (e) { showTip(e, html); });
    el.addEventListener('mouseleave', hideTip);
  }

  // ---------- filters UI ----------
  function fillSelect(id, label, values, cur) {
    var el = $(id);
    var opts = ['<option value="">' + esc(label) + '</option>'];
    values.sort(function (a, b) { return a.localeCompare(b, 'ru'); }).forEach(function (v) {
      opts.push('<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>');
    });
    el.innerHTML = opts.join('');
    el.value = cur;
  }
  function renderSelects() {
    fillSelect('fCat', 'Все направления', uniq(filtered(['cat']).map(function (r) { return r.category; }).concat(S.cat ? [S.cat] : [])), S.cat);
    fillSelect('fCountry', 'Все страны', uniq(filtered(['country']).map(function (r) { return r.country; }).concat(S.country ? [S.country] : [])), S.country);
    var cities = [];
    filtered(['city']).forEach(function (r) { cities = cities.concat(splitCities(r.city)); });
    fillSelect('fCity', 'Все города', uniq(cities.concat(S.city ? [S.city] : [])), S.city);
    fillSelect('fStatus', 'Все статусы', uniq(filtered(['status']).map(function (r) { return r.status; }).concat(S.status ? [S.status] : [])), S.status);
    $('fSource').value = S.source;
    $('fPeriod').value = S.period;
    $('fFund').checked = S.fund;
    if ($('fSearch').value !== S.q) $('fSearch').value = S.q;
    $('fSource').disabled = $('fPeriod').disabled = !!S.project;
  }
  function renderChips() {
    var chips = [];
    if (S.project) chips.push(['project', 'Проект: ' + S.project + ' — все годы и источники']);
    if (S.cat) chips.push(['cat', 'Направление: ' + S.cat]);
    if (S.country) chips.push(['country', 'Страна: ' + S.country]);
    if (S.city) chips.push(['city', 'Город: ' + S.city]);
    if (S.status) chips.push(['status', 'Статус: ' + S.status]);
    $('chips').innerHTML = chips.map(function (c) {
      return '<button class="chip" type="button" data-k="' + c[0] + '">' + esc(c[1]) + ' ✕</button>';
    }).join('');
    $('warn').hidden = !(S.source === 'both' || S.project);
    $('warn').textContent = S.project
      ? 'Показаны записи проекта из обоих источников: внутренний перечень и отчёты пересекаются, сумма ориентировочная.'
      : 'Выбраны оба источника: они пересекаются, поэтому суммы ориентировочные.';
  }
  $('chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    S[b.dataset.k] = ''; render();
  });

  function setPeriod(p) {
    S.period = p;
    if (FRHC_PERIODS.indexOf(p) >= 0 && S.source === 'internal') S.source = 'frhc';
    if (INTERNAL_PERIODS.indexOf(p) >= 0 && S.source === 'frhc') S.source = 'internal';
  }
  $('fSource').addEventListener('change', function (e) {
    S.source = e.target.value;
    if (S.source === 'internal' && FRHC_PERIODS.indexOf(S.period) >= 0) S.period = 'fact';
    if (S.source === 'frhc' && INTERNAL_PERIODS.indexOf(S.period) >= 0) S.period = 'fact';
    render();
  });
  $('fPeriod').addEventListener('change', function (e) { setPeriod(e.target.value); render(); });
  var qTimer;
  $('fSearch').addEventListener('input', function (e) {
    clearTimeout(qTimer); qTimer = setTimeout(function () { S.q = e.target.value; render(); }, 150);
  });
  [['fCat', 'cat'], ['fCountry', 'country'], ['fCity', 'city'], ['fStatus', 'status']].forEach(function (p) {
    $(p[0]).addEventListener('change', function (e) { S[p[1]] = e.target.value; render(); });
  });
  $('fFund').addEventListener('change', function (e) { S.fund = e.target.checked; render(); });
  $('resetBtn').addEventListener('click', function () { S = Object.assign({}, DEFAULT); render(); });

  // ---------- tabs ----------
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.dataset.tab); });
  });
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === t); });
    document.querySelectorAll('.tab').forEach(function (s) { s.hidden = s.id !== 'tab-' + t; });
    hideTip();
  }

  // ---------- header & tiles ----------
  function renderTiles(rows) {
    var Y = D.yearly.slice().sort(function (a, b) { return a.fy - b.fy; });
    var last = Y[Y.length - 1], prev = Y[Y.length - 2];
    var growth = (last.esg_total_kzt_bn / prev.esg_total_kzt_bn - 1) * 100;
    $('lead').textContent = 'Внешние ESG-проекты группы за ' + last.fy_label + ' — ' + nf2.format(last.esg_total_kzt_bn) +
      ' млрд ₸, это на ' + nf1.format(growth) + '% больше, чем за ' + prev.fy_label + ' (' + nf2.format(prev.esg_total_kzt_bn) + ' млрд ₸).';

    var main = rows.filter(function (r) { return !r.is_part; });
    var sum = sumKzt(rows);
    var fundSum = sumKzt(rows.filter(function (r) { return r.is_fund; }));
    var cities = uniq([].concat.apply([], rows.map(function (r) { return splitCities(r.city); })));
    var countries = uniq(rows.map(function (r) { return r.country; }).filter(function (c) { return c !== 'Международный'; }));
    var perLabel = S.project ? 'проект, все годы' : ($('fPeriod').selectedOptions[0] || {}).textContent;
    var srcLabel = S.project ? 'оба источника' : ($('fSource').selectedOptions[0] || {}).textContent;

    var t = [
      { k: 'ESG-проекты ' + last.fy_label, v: nf2.format(last.esg_total_kzt_bn) + ' млрд ₸', s: 'официальный итог отчёта' },
      { k: 'Рост к ' + prev.fy_label, v: (growth >= 0 ? '+' : '') + nf1.format(growth) + '%', s: nf2.format(prev.esg_total_kzt_bn) + ' → ' + nf2.format(last.esg_total_kzt_bn) + ' млрд ₸' },
      { k: 'Проектов в выборке', v: nf0.format(main.length), s: bn(sum) + ' млрд ₸ · ' + srcLabel + ', ' + perLabel, sel: 1 },
      { k: 'Доля фонда Шапағат', v: sum ? nf0.format(fundSum / sum * 100) + '%' : '—', s: bn(fundSum) + ' млрд ₸ в выборке', sel: 1 },
      { k: 'География выборки', v: cities.length + ' / ' + countries.length, s: 'городов / стран', sel: 1 },
      { k: 'Сотрудники группы', v: nf0.format(last.employees), s: 'на конец ' + last.fy_label }
    ];
    $('tiles').innerHTML = t.map(function (x) {
      return '<div class="tile' + (x.sel ? ' sel' : '') + '"><div class="k">' + esc(x.k) + '</div><div class="v">' + esc(x.v) +
        '</div><div class="s">' + esc(x.s) + '</div></div>';
    }).join('');
  }

  // ---------- charts ----------
  function hbars(el, items, fmt, onClick, active) {
    if (!items.length) { el.innerHTML = '<div class="empty">Нет данных</div>'; return; }
    var max = Math.max.apply(null, items.map(function (i) { return i.v; })) || 1;
    el.innerHTML = '';
    items.forEach(function (i) {
      var row = document.createElement('div');
      row.className = 'hbar' + (active === i.k ? ' on' : '');
      row.innerHTML = '<span class="lab">' + esc(i.k) + '</span><span class="track"><span class="fill" style="display:block;width:' +
        (i.v / max * 100).toFixed(2) + '%"></span></span><span class="val">' + esc(fmt(i.v)) + '</span>';
      bindTip(row, '<b>' + esc(i.k) + '</b><br>' + esc(i.tip || fmt(i.v)));
      row.addEventListener('click', function () { hideTip(); onClick(i.k); });
      el.appendChild(row);
    });
  }
  function vbars(el, items, onClick, active) {
    var max = Math.max.apply(null, items.map(function (i) { return i.v; })) || 1;
    el.innerHTML = '';
    items.forEach(function (i) {
      var b = document.createElement('div');
      b.className = 'vbar' + (active === i.k ? ' on' : '');
      b.innerHTML = '<span class="val">' + esc(nf2.format(i.v)) + '</span><span class="col' + (i.plan ? ' plan' : '') +
        '" style="height:' + (i.v / max * 78).toFixed(2) + '%"></span><span class="lab">' + esc(i.label || i.k) + '</span>';
      bindTip(b, '<b>' + esc(i.k) + '</b><br>' + esc(i.tip));
      b.addEventListener('click', function () { hideTip(); onClick(i.k); });
      el.appendChild(b);
    });
  }

  function renderProjectCharts(rows) {
    var byCat = {};
    rows.forEach(function (r) { if (!r.is_part && isKzt(r)) byCat[r.category] = (byCat[r.category] || 0) + r.kzt_mln; });
    var cats = Object.keys(byCat).map(function (k) { return { k: k, v: byCat[k], tip: mln(byCat[k]) + ' млн ₸' }; })
      .sort(function (a, b) { return b.v - a.v; });
    hbars($('chCat'), cats, mln, function (k) { S.cat = S.cat === k ? '' : k; render(); }, S.cat);

    // internal by period: same filters except source/period/project
    var base = filtered(['source', 'period', 'project']);
    var internal = INTERNAL_PERIODS.map(function (p) {
      var rs = base.filter(function (r) { return r.source_type === INTERNAL && r.period_label === p; });
      var s = sumKzt(rs) / 1000;
      return { k: p, label: p === PLAN ? 'План 26–27' : p, v: s, plan: p === PLAN,
        tip: nf2.format(s) + ' млрд ₸ · ' + rs.filter(function (r) { return !r.is_part; }).length + ' проектов' };
    });
    vbars($('chInternal'), internal, function (k) { S.project = ''; setPeriod(S.period === k ? 'fact' : k); render(); }, S.project ? '' : S.period);

    var frhc = D.yearly.slice().sort(function (a, b) { return a.fy - b.fy; }).map(function (y) {
      var rs = base.filter(function (r) { return r.source_type === FRHC && r.period_label === y.fy_label; });
      return { k: y.fy_label, v: y.esg_total_kzt_bn,
        tip: 'Итог отчёта: ' + nf2.format(y.esg_total_kzt_bn) + ' млрд ₸' + (y.fund_total_kzt_bn ? ' (фонд: ' + nf2.format(y.fund_total_kzt_bn) + ')' : '') +
          '. Поштучно в ₸ при текущих фильтрах: ' + bn(sumKzt(rs)) + ' млрд' };
    });
    vbars($('chFrhc'), frhc, function (k) { S.project = ''; setPeriod(S.period === k ? 'fact' : k); render(); }, S.project ? '' : S.period);
  }

  // ---------- tables ----------
  function statusClass(s) {
    return { 'Завершён': 'done', 'Строительство': 'build', 'Действующая программа': 'prog', 'Профинансирован': 'paid', 'План': 'plan' }[s] || 'paid';
  }
  function sortRows(rows, st, getters) {
    var g = getters[st.key] || function (r) { return r[st.key]; };
    return rows.slice().sort(function (a, b) {
      var x = g(a), y = g(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      var c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru');
      return c * st.dir;
    });
  }
  function header(cols, st) {
    return '<thead><tr>' + cols.map(function (c) {
      var arrow = st && st.key === c.key ? (st.dir > 0 ? ' ▲' : ' ▼') : '';
      return '<th data-key="' + c.key + '" class="' + (c.cls || '') + (c.nosort ? ' nosort' : '') + '">' + esc(c.label) + arrow + '</th>';
    }).join('') + '</tr></thead>';
  }
  function bindSort(table, st, fn) {
    table.querySelectorAll('th[data-key]').forEach(function (th) {
      if (th.classList.contains('nosort')) return;
      th.addEventListener('click', function () {
        var k = th.dataset.key;
        if (st.key === k) st.dir = -st.dir; else { st.key = k; st.dir = (k === 'amount' || k === 'sum' || k === 'n') ? -1 : 1; }
        fn();
      });
    });
  }

  function renderProjectsTable(rows) {
    var cols = [
      { key: 'sort', label: 'Год' },
      { key: 'name', label: 'Проект' },
      { key: 'category', label: 'Направление', cls: 'sec' },
      { key: 'city', label: 'Город' },
      { key: 'country', label: 'Страна', cls: 'sec' },
      { key: 'amount', label: 'Сумма', cls: 'num' },
      { key: 'currency', label: 'Валюта', cls: 'sec' },
      { key: 'status', label: 'Статус' },
      { key: 'payer', label: 'Кто финансировал', cls: 'sec' },
      { key: 'source', label: 'Источник', cls: 'sec' }
    ];
    var st = sort.projects;
    var sorted = sortRows(rows, st, { amount: function (r) { return isKzt(r) ? r.kzt_mln : r.amount; } });
    var t = $('tblProjects');
    if (!rows.length) { t.innerHTML = header(cols, st) + '<tbody><tr><td colspan="10" class="empty">Ничего не найдено — измените фильтры или нажмите «Сбросить»</td></tr></tbody>'; bindSort(t, st, render); }
    else {
      t.innerHTML = header(cols, st) + '<tbody>' + sorted.map(function (r, i) {
        var amt = r.amount == null ? '—' : (r.currency === 'KZT' ? mln(r.amount) : nf2.format(r.amount));
        var unit = r.currency === 'KZT' ? 'млн ₸' : (r.unit || r.currency);
        var showAlias = r.alias && !/^№/.test(r.alias) && r.alias !== r.name;
        var proj = r.project && r.project !== r.name && r.project !== r.alias ? r.project : '';
        return '<tr class="click' + (r.is_part ? ' part' : '') + '" data-i="' + i + '">' +
          '<td>' + esc(r.period_label) + '</td>' +
          '<td>' + (r.is_part ? 'в т.ч. ' : '') + esc(r.name) +
            (showAlias ? ' <span class="alias">· ' + esc(r.alias) + '</span>' : '') +
            (proj ? '<br><span class="alias">↳ ' + esc(proj) + '</span>' : '') +
            (r.note ? '<br><span class="note">' + esc(r.note) + '</span>' : '') + '</td>' +
          '<td class="sec">' + esc(r.category) + '</td>' +
          '<td>' + esc(r.city) + '</td>' +
          '<td class="sec">' + esc(r.country) + '</td>' +
          '<td class="num">' + amt + '</td>' +
          '<td class="sec">' + esc(unit) + '</td>' +
          '<td><span class="badge ' + statusClass(r.status) + '">' + esc(r.status) + '</span></td>' +
          '<td class="sec">' + esc(r.payer) + '</td>' +
          '<td class="sec src">' + esc(r.source) + '</td></tr>';
      }).join('') + '</tbody>';
      bindSort(t, st, render);
      t.querySelectorAll('tbody tr').forEach(function (tr) {
        tr.addEventListener('click', function () {
          var r = sorted[+tr.dataset.i];
          S.project = S.project === r.project ? '' : r.project;
          render();
          $('tblProjects').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
    var main = rows.filter(function (r) { return !r.is_part; });
    var fx = main.filter(function (r) { return !isKzt(r); }).length;
    $('counter').textContent = 'найдено ' + nf0.format(main.length) + ' · ' + mln(sumKzt(rows)) + ' млн ₸' +
      (fx ? ' · ещё ' + fx + ' в валюте' : '') +
      (rows.length > main.length ? ' · строк «в т.ч.»: ' + (rows.length - main.length) : '');
  }

  function renderGeo(rows) {
    var byCountry = {};
    rows.forEach(function (r) { if (!r.is_part) byCountry[r.country] = (byCountry[r.country] || 0) + 1; });
    var cs = Object.keys(byCountry).map(function (k) { return { k: k, v: byCountry[k], tip: byCountry[k] + ' проектов' }; })
      .sort(function (a, b) { return b.v - a.v; });
    hbars($('chCountry'), cs, nf0.format, function (k) { S.country = S.country === k ? '' : k; S.city = ''; render(); }, S.country);

    var byCity = {};
    rows.forEach(function (r) {
      splitCities(r.city).forEach(function (c) {
        var o = byCity[c] || (byCity[c] = { name: c, country: r.country, sum: 0, n: 0, fx: 0 });
        if (!r.is_part) o.n++;
        // «в т.ч.» rows (вузы Freedom Grants) give a city its share, but parent rows have no city
        if (isKzt(r) && (r.is_part || splitCities(r.city).length === 1)) o.sum += r.kzt_mln;
        if (!isKzt(r)) o.fx++;
      });
    });
    var list = Object.keys(byCity).map(function (k) { return byCity[k]; });
    var st = sort.cities;
    var sorted = sortRows(list, st, {});
    var cols = [
      { key: 'rank', label: '#', nosort: true },
      { key: 'name', label: 'Город' },
      { key: 'country', label: 'Страна', cls: 'sec' },
      { key: 'sum', label: 'Сумма, млн ₸', cls: 'num' },
      { key: 'n', label: 'Проектов', cls: 'num' }
    ];
    var t = $('tblCities');
    t.innerHTML = header(cols, st) + '<tbody>' + (sorted.length ? sorted.map(function (c, i) {
      return '<tr class="click" data-c="' + esc(c.name) + '"><td class="num">' + (i + 1) + '</td><td>' + esc(c.name) + '</td><td class="sec">' +
        esc(c.country) + '</td><td class="num">' + mln(c.sum) + (c.fx ? ' <span class="alias">+' + c.fx + ' вал.</span>' : '') +
        '</td><td class="num">' + c.n + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">Нет городов в выборке</td></tr>') + '</tbody>';
    bindSort(t, st, render);
    t.querySelectorAll('tbody tr[data-c]').forEach(function (tr) {
      tr.addEventListener('click', function () { S.city = tr.dataset.c; render(); setTab('projects'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });
  }

  function renderMulti() {
    // all periods and both sources; other filters apply
    var rows = filtered(['source', 'period', 'project']);
    var periods = INTERNAL_PERIODS.concat(FRHC_PERIODS);
    var by = {};
    rows.forEach(function (r) {
      if (r.is_part) return;
      var o = by[r.project] || (by[r.project] = { name: r.project, category: r.category, p: {}, fx: {} });
      if (isKzt(r)) o.p[r.period_label] = (o.p[r.period_label] || 0) + r.kzt_mln;
      else { o.fx[r.period_label] = (o.fx[r.period_label] || '') + (o.fx[r.period_label] ? '; ' : '') + nf2.format(r.amount) + ' ' + (r.unit || r.currency); o.p[r.period_label] = o.p[r.period_label] || 0; }
    });
    var list = Object.keys(by).map(function (k) { return by[k]; }).filter(function (o) { return Object.keys(o.p).length >= 2; });
    list.forEach(function (o) { o.n = Object.keys(o.p).length; periods.forEach(function (p) { o[p] = o.p[p]; }); });
    var st = sort.multi;
    var sorted = sortRows(list, st, {});
    var cols = [{ key: 'name', label: 'Проект (единое название)' }, { key: 'category', label: 'Направление', cls: 'sec' }]
      .concat(periods.map(function (p) { return { key: p, label: p === PLAN ? 'План 26–27' : p, cls: 'num' }; }))
      .concat([{ key: 'n', label: 'Периодов', cls: 'num' }]);
    var t = $('tblMulti');
    t.innerHTML = header(cols, st) + '<tbody>' + (sorted.length ? sorted.map(function (o) {
      return '<tr class="click" data-p="' + esc(o.name) + '"><td>' + esc(o.name) + '</td><td class="sec">' + esc(o.category) + '</td>' +
        periods.map(function (p) {
          var v = o.p[p];
          var txt = v == null ? '<span class="muted">—</span>' : (v ? mln(v) : '') + (o.fx[p] ? (v ? '<br>' : '') + '<span class="alias">' + esc(o.fx[p]) + '</span>' : '');
          return '<td class="num">' + txt + '</td>';
        }).join('') + '<td class="num">' + o.n + '</td></tr>';
    }).join('') : '<tr><td colspan="10" class="empty">Нет многолетних проектов при текущих фильтрах</td></tr>') + '</tbody>';
    bindSort(t, st, render);
    t.querySelectorAll('tbody tr[data-p]').forEach(function (tr) {
      tr.addEventListener('click', function () { S.project = tr.dataset.p; render(); setTab('projects'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });
    $('multiCounter').textContent = list.length + ' проектов';
  }

  function renderEsg() {
    var Y = D.yearly.slice().sort(function (a, b) { return a.fy - b.fy; });
    var rowsDef = [
      ['ESG-проекты, млрд ₸', function (y) { return nf2.format(y.esg_total_kzt_bn) + (y.fund_total_kzt_bn ? ' (фонд: ' + nf2.format(y.fund_total_kzt_bn) + ')' : ''); }],
      ['Сотрудники', function (y) { return nf0.format(y.employees); }],
      ['Текучесть кадров', function (y) { return nf1.format(y.turnover_pct) + '%'; }],
      ['Scope 1, т CO₂-экв.', function (y) { return y.scope1_t == null ? '—' : nf0.format(y.scope1_t); }],
      ['Scope 2, т CO₂-экв.', function (y) { return y.scope2_t == null ? '—' : nf0.format(y.scope2_t); }],
      ['Scope 3 (операционные), т', function (y) { return y.scope3_ops_t == null ? '—' : nf0.format(y.scope3_ops_t); }],
      ['Финансируемые выбросы, млн т', function (y) { return y.financed_mt == null ? '—' : nf2.format(y.financed_mt) + (y.fy === 2026 ? '*' : ''); }],
      ['Источник', function (y) { return y.source; }]
    ];
    $('tblYearly').innerHTML = '<thead><tr><th class="nosort">Показатель</th>' + Y.map(function (y) { return '<th class="nosort num">' + esc(y.fy_label) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rowsDef.map(function (d) {
        return '<tr><td>' + esc(d[0]) + '</td>' + Y.map(function (y) { return '<td class="num' + (d[0] === 'Источник' ? ' src' : '') + '">' + esc(d[1](y)) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody>';
    $('tblFfg').innerHTML = '<thead><tr><th class="nosort">Показатель</th><th class="nosort num">Значение</th><th class="nosort sec">Комментарий</th><th class="nosort num">Стр.</th></tr></thead><tbody>' +
      D.ffg.map(function (m) {
        return '<tr><td>' + esc(m.metric) + '</td><td class="num">' + esc(m.value) + '</td><td class="sec muted">' + esc(m.note) + '</td><td class="num">' + esc(m.page) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  // ---------- theme ----------
  $('themeBtn').addEventListener('click', function () {
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* ignore */ }
  });
  try { var th = localStorage.getItem('theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) { /* ignore */ }

  // ---------- render ----------
  function render() {
    renderSelects();
    renderChips();
    var rows = filtered();
    renderTiles(rows);
    renderProjectCharts(rows);
    renderProjectsTable(rows);
    renderGeo(rows);
    renderMulti();
  }
  renderEsg();
  render();
})();
