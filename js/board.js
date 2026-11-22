// TERROVA live board: peta 50x50 + panel specimen + statistik on-chain.
// Read-only. Mint, merge, dan klaim berjalan lewat agen (lihat skill.md).
(function () {
  var CFG = window.TERROVA_CONFIG || {};
  var TERRAIN = window.TERROVA_TERRAIN || "";
  var NAMES = ["Coast", "Valley", "Forest", "Desert", "Peak"];
  var RPCS = [
    "https://bsc-dataseed.binance.org",
    "https://bsc-dataseed1.defibit.io",
    "https://bsc.publicnode.com",
    "https://bsc-dataseed.bnbchain.org"
  ];
  var rpcIdx = 0;
  var state = { minted: {}, owners: {}, estates: {}, consumed: {}, claimed: {}, selected: 7 };

  function rpc(method, params) {
    var tries = 0;
    function attempt() {
      var url = RPCS[(rpcIdx + tries) % RPCS.length];
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method, params: params })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.error) throw new Error(j.error.message || "rpc error");
        rpcIdx = (rpcIdx + tries) % RPCS.length;
        return j.result;
      }).catch(function (e) {
        tries++;
        if (tries >= RPCS.length) throw e;
        return attempt();
      });
    }
    return attempt();
  }
  function call(to, data) { return rpc("eth_call", [{ to: to, data: data }, "latest"]); }
  function padAddr(a) { return "000000000000000000000000" + a.replace("0x", "").toLowerCase(); }
  function padNum(n) { return BigInt(n).toString(16).padStart(64, "0"); }
  function u256(hex) { return hex && hex !== "0x" ? BigInt(hex) : 0n; }
  function fmt(n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function fmtTok(wei) { var t = wei / (10n ** 18n); if (t >= 1000000n) return fmt((t / 1000000n).toString()) + "M"; return fmt(t.toString()); }
  function short(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : "—"; }

  // ---------- bangun grid ----------
  var mapEl = document.getElementById("map");
  var cells = [];
  if (mapEl) {
    var frag = document.createDocumentFragment();
    for (var i = 1; i <= 2500; i++) {
      var d = document.createElement("div");
      d.className = "c t" + (TERRAIN[i - 1] || "1");
      d.dataset.id = i;
      frag.appendChild(d);
      cells[i] = d;
    }
    mapEl.appendChild(frag);
    mapEl.addEventListener("click", function (ev) {
      var t = ev.target;
      if (t && t.dataset && t.dataset.id) select(parseInt(t.dataset.id, 10));
    });
  }

  function paint() {
    for (var id = 1; id <= 2500; id++) {
      var c = cells[id];
      if (!c) continue;
      c.classList.toggle("minted", !!state.minted[id] && !state.consumed[id]);
      c.classList.toggle("consumed", !!state.consumed[id]);
    }
    Object.keys(state.estates).forEach(function (eid) {
      var e = state.estates[eid];
      [e.a, e.b].forEach(function (pid) {
        if (cells[pid]) { cells[pid].classList.add("estate"); cells[pid].classList.remove("consumed"); }
      });
    });
    if (cells[state.selected]) {
      cells.forEach(function (c) { if (c) c.classList.remove("sel"); });
      cells[state.selected].classList.add("sel");
    }
  }

  function select(id) {
    state.selected = id;
    paint();
    renderSpecimen(id);
  }

  function coord(id) { var i = id - 1; return { x: (i % 50) + 1, y: Math.floor(i / 50) + 1 }; }

  function renderSpecimen(id) {
    var box = document.getElementById("specimen");
    if (!box) return;
    var cd = coord(id);
    var t = parseInt(TERRAIN[id - 1] || "1", 10);
    var owner = state.owners[id];
    var estate = null;
    Object.keys(state.estates).forEach(function (eid) {
      var e = state.estates[eid];
      if (e.a === id || e.b === id) estate = { id: eid, other: e.a === id ? e.b : e.a };
    });
    var status, statusCls = "";
    if (estate) { status = "Part of Estate #" + estate.id; statusCls = "amber"; }
    else if (state.consumed[id]) { status = "Merged away"; }
    else if (owner) { status = "Minted"; statusCls = "live"; }
    else { status = CFG.mintOpen ? "Open" : "Surveyed, awaiting launch"; }
    var claimTxt = estate ? "300,000 TERRA via Estate" : "100,000 TERRA";
    if (estate && state.claimed[estate.id]) claimTxt = "Claimed";
    if (!estate && state.claimed[id]) claimTxt = "Claimed";
    box.innerHTML =
      '<div class="plate"><img src="img/plots/' + id + '.webp" alt="Plot ' + id + ' terrain plate" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
      '<div style="display:none;aspect-ratio:1/1;border-radius:8px;background:var(--ink3);align-items:center;justify-content:center;font-family:Mono,monospace;font-size:12px;color:var(--mut);letter-spacing:1.5px">PLATE IN PRODUCTION</div>' +
      '<div class="cap"><span>PLATE Nº ' + id + '</span><b>' + NAMES[t].toUpperCase() + '</b></div></div>' +
      '<div class="spec-data"><h3>Plot #' + id + '</h3>' +
      '<div style="margin-top:8px"><span class="badge ' + statusCls + '">' + status + '</span></div>' +
      '<div class="spec-rows">' +
      '<div class="row"><span class="k">Coordinates</span><span class="v">COL ' + cd.x + ' · ROW ' + cd.y + '</span></div>' +
      '<div class="row"><span class="k">Terrain</span><span class="v">' + NAMES[t] + '</span></div>' +
      '<div class="row"><span class="k">Owner</span><span class="v">' + (owner ? short(owner) : "—") + '</span></div>' +
      '<div class="row"><span class="k">Claim value</span><span class="v">' + claimTxt + '</span></div>' +
      (estate ? '<div class="row"><span class="k">Estate partner</span><span class="v">Plot #' + estate.other + '</span></div>' : '') +
      '</div>' +
      '<p style="margin-top:14px;color:var(--bone2);font-size:14.5px">Minting runs through your agent. First plot is free with an Agent ID, later plots cost 0.0002 BNB, max 10 per wallet. Full instructions live in <a href="docs">Docs</a> and the <a href="skill.md">agent skill file</a>.</p>' +
      '</div>';
  }

  function setText(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }

  // ---------- muat data on-chain ----------
  function loadChain() {
    if (!CFG.plots) { setText("st-status", "PRE-LAUNCH SURVEY"); return; }
    var EV_MINT = "0x9bbf27df6dc536120167c8098337e8247e2858aa947f549182646c35c9d30c38";
    var EV_MERGE = "0xce7f10f82d9561d266b30c12cdda31505b73abff9eb0d6c1f45938a21c41bbbb";
    var EV_CLAIM = "0xf0a271696089bb4e9e39c978b100f1892bfc98a87493ad2e459b06c417c6c583";
    var fromBlock = CFG.deployBlock ? "0x" + CFG.deployBlock.toString(16) : "0x0";

    rpc("eth_getLogs", [{ address: CFG.plots, topics: [EV_MINT], fromBlock: fromBlock, toBlock: "latest" }]).then(function (logs) {
      (logs || []).forEach(function (l) {
        var id = Number(BigInt("0x" + l.data.slice(2, 66)));
        var owner = "0x" + l.topics[1].slice(26);
        state.minted[id] = true; state.owners[id] = owner;
      });
      paint(); renderSpecimen(state.selected);
    }).catch(function () {});
    rpc("eth_getLogs", [{ address: CFG.plots, topics: [EV_MERGE], fromBlock: fromBlock, toBlock: "latest" }]).then(function (logs) {
      (logs || []).forEach(function (l) {
        var d = l.data.slice(2);
        var a = Number(BigInt("0x" + d.slice(0, 64)));
        var b = Number(BigInt("0x" + d.slice(64, 128)));
        var eid = Number(BigInt("0x" + d.slice(128, 192)));
        state.estates[eid] = { a: a, b: b };
        state.consumed[a] = true; state.consumed[b] = true;
        state.owners[a] = "0x" + l.topics[1].slice(26);
        state.owners[b] = state.owners[a];
      });
      paint(); renderSpecimen(state.selected);
    }).catch(function () {});
    if (CFG.claim) {
      rpc("eth_getLogs", [{ address: CFG.claim, topics: [EV_CLAIM], fromBlock: fromBlock, toBlock: "latest" }]).then(function (logs) {
        (logs || []).forEach(function (l) {
          var id = Number(BigInt("0x" + l.data.slice(2, 66)));
          state.claimed[id] = true;
        });
        renderSpecimen(state.selected);
      }).catch(function () {});
    }

    call(CFG.plots, "0xa2309ff8").then(function (h) { setText("st-minted", fmt(u256(h).toString())); }).catch(function () {});
    call(CFG.plots, "0xa26dbf26").then(function (h) { setText("st-agents", fmt(u256(h).toString())); }).catch(function () {});
    call(CFG.plots, "0x6c84b490").then(function (h) { setText("st-estates", fmt(u256(h).toString())); }).catch(function () {});
    call(CFG.plots, "0x24bbd049").then(function (h) {
      CFG.mintOpen = u256(h) === 1n;
      setText("st-status", CFG.mintOpen ? "MINT OPEN" : "MINT CLOSED");
      renderSpecimen(state.selected);
    }).catch(function () {});
    if (CFG.claim && CFG.token) {
      call(CFG.claim, "0x96365d44").then(function (h) { setText("st-pool", fmtTok(u256(h)) + " TERRA"); }).catch(function () {});
      call(CFG.claim, "0xd54ad2a1").then(function (h) { setText("st-claimed", fmt(u256(h).toString())); }).catch(function () {});
      call(CFG.claim, "0x4b8bcb58").then(function (h) { setText("st-claim-status", u256(h) === 1n ? "CLAIM OPEN" : "CLAIM CLOSED"); }).catch(function () {});
    }
  }

  paint();
  renderSpecimen(state.selected);
  loadChain();
  setInterval(loadChain, 60000);
})();
