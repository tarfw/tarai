(() => {
  const meta = [
    { id: "loop", kicker: "01 / The loop", title: "One request. One loop." },
    { id: "lanes", kicker: "02 / Lanes", title: "Three lanes. No overlap." },
    { id: "canvas", kicker: "03 / Canvas", title: "Only the cards you may use, now." },
    { id: "card", kicker: "04 / Card", title: "A saved read. One tap." },
    { id: "flow", kicker: "05 / Flow", title: "Eight shapes. One engine." },
    { id: "ladder", kicker: "06 / Ladder", title: "Never pay for a known answer." },
    { id: "store", kicker: "07 / Store", title: "Describe once. Gate. Publish." },
    { id: "kernel", kicker: "08 / Kernel", title: "One registry. Balanced truth." }
  ];

  const sceneEls = [...document.querySelectorAll(".scene")];
  const navItems = [...document.querySelectorAll(".nav-item")];
  const kicker = document.getElementById("kicker");
  const title = document.getElementById("title");
  let current = 0;

  function showScene(i, push) {
    current = (i + meta.length) % meta.length;
    sceneEls.forEach((el, n) => el.classList.toggle("is-active", n === current));
    navItems.forEach((el, n) => el.classList.toggle("is-active", n === current));
    kicker.textContent = meta[current].kicker;
    title.textContent = meta[current].title;
    if (push !== false) {
      history.replaceState(null, "", "#" + meta[current].id);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (window.innerWidth <= 960) {
      const nav = document.querySelector(".nav");
      const active = navItems[current];
      const navRect = nav.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const target = nav.scrollLeft + activeRect.left - navRect.left - (nav.clientWidth - activeRect.width) / 2;
      nav.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }
    if (meta[current].id === "loop") requestAnimationFrame(() => positionTraveler(loopIndex));
  }

  navItems.forEach((el) => {
    el.addEventListener("click", () => showScene(Number(el.dataset.go)));
  });
  document.getElementById("prevBtn").addEventListener("click", () => showScene(current - 1));
  document.getElementById("nextBtn").addEventListener("click", () => showScene(current + 1));
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") showScene(current + 1);
    if (e.key === "ArrowLeft") showScene(current - 1);
  });

  const loopNodes = [...document.querySelectorAll("#loopNodes .node")];
  const traveler = document.getElementById("traveler");
  const loopWrap = document.getElementById("loopNodes");
  let loopIndex = 0;

  function positionTraveler(i) {
    if (!loopNodes[i] || !traveler) return;
    const node = loopNodes[i];
    const center = node.offsetLeft + node.offsetWidth / 2;
    traveler.style.left = center + "px";
  }

  function paintLoop(i) {
    loopNodes.forEach((node, n) => {
      node.classList.toggle("active", n === i);
      node.classList.toggle("done", n < i);
    });
    positionTraveler(i);
  }

  paintLoop(0);
  setInterval(() => {
    if (meta[current].id !== "loop") return;
    loopIndex = (loopIndex + 1) % loopNodes.length;
    paintLoop(loopIndex);
  }, 1700);
  window.addEventListener("resize", () => positionTraveler(loopIndex));

  const roles = {
    owner: {
      name: "Owner",
      sub: "Full access · 6 cards",
      count: 6,
      grant: true,
      useful: true,
      cards: [
        { kind: "alert", title: "Cash drawer out ₹350", sub: "Shift 14 · tap to audit", tag: "money" },
        { kind: "next", title: "Dispatch order 42", sub: "due 15m", action: "Complete", tag: "customer" },
        { kind: "card", title: "Counter Sales", tag: "money", metrics: [["₹18,450", "today"], ["₹14,100", "UPI"]], note: "14 bills · drawer ₹4,350", action: "New Counter Sale" },
        { kind: "card", title: "Orders and Dispatch", tag: "customer", metrics: [["3", "pending"], ["11", "shipped"]], action: "Open Queue" },
        { kind: "card", title: "Online Store", tag: "customer", metrics: [["142", "visits"], ["8", "enquiries"]], action: "View Store" },
        { kind: "flow", title: "Shop Closing", tag: "none", progress: 50, note: "Step 2 / 4 · count cash", action: "Resume" }
      ]
    },
    cashier: {
      name: "Cashier",
      sub: "Shift only · 4 cards",
      count: 4,
      grant: true,
      useful: true,
      cards: [
        { kind: "next", title: "Pack parcel for Senthamizh", sub: "2 items · due 15m", action: "Start", tag: "customer" },
        { kind: "card", title: "Counter Register", tag: "money", metrics: [["9", "bills"], ["₹4,350", "drawer"]], action: "Quick Sale" },
        { kind: "card", title: "Order Packing", tag: "customer", metrics: [["2", "to pack"], ["7", "packed"]], action: "Start Packing" },
        { kind: "card", title: "Inbox · Tasks", tag: "none", metrics: [["2", "waiting"], ["1", "overdue"]], action: "Open Feed" },
        { kind: "flow", title: "Shift Handover", tag: "none", progress: 0, note: "16:00 · not started", action: "Start Handover" }
      ]
    },
    guest: {
      name: "Guest",
      sub: "Public view only · 0 cards",
      count: 0,
      grant: false,
      useful: false,
      cards: []
    }
  };

  const phoneCards = document.getElementById("phoneCards");
  const phoneRole = document.getElementById("phoneRole");
  const phoneSub = document.getElementById("phoneSub");
  const visibleCount = document.getElementById("visibleCount");
  const visibleStrip = document.getElementById("visibleStrip");
  const keyGrant = document.getElementById("keyGrant");
  const keyUseful = document.getElementById("keyUseful");
  const eventDots = document.getElementById("eventDots");
  eventDots.innerHTML = Array.from({ length: 18 }, () => '<i class="event-dot"></i>').join("");

  function cardMarkup(card, index) {
    const delay = 'style="animation-delay:' + index * 45 + 'ms"';
    if (card.kind === "alert") {
      return '<div class="p-card p-alert" ' + delay + '><svg class="ico"><use href="#i-alert"/></svg><div><b>' + card.title + '</b><small>' + card.sub + '</small></div><span>›</span></div>';
    }
    if (card.kind === "next") {
      return '<div class="p-card p-next" ' + delay + '><div><div class="p-title">Next · ' + card.tag + '</div><small>' + card.title + '</small><small>' + card.sub + '</small></div><span>' + card.action + '</span></div>';
    }
    if (card.kind === "flow") {
      return '<div class="p-card" ' + delay + '><div class="p-flow-top"><span class="p-title">' + card.title + '</span><span class="reach ' + card.tag + '">' + card.tag + '</span></div><div class="p-flow-note">' + card.note + '</div><div class="p-progress"><i style="--w:' + card.progress + '%"></i></div><button class="p-action">' + card.action + '</button></div>';
    }
    const metrics = card.metrics.map((m) => '<div class="p-metric"><b>' + m[0] + '</b><span>' + m[1] + '</span></div>').join("");
    const note = card.note ? '<div class="p-flow-note">' + card.note + '</div>' : "";
    return '<div class="p-card" ' + delay + '><div class="p-card-head"><span class="p-title">' + card.title + '</span><span class="reach ' + card.tag + '">' + card.tag + '</span></div>' + note + '<div class="p-metrics">' + metrics + '</div><button class="p-action">' + card.action + '</button></div>';
  }

  function renderRole(roleKey) {
    const role = roles[roleKey];
    document.querySelectorAll(".role-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.role === roleKey));
    phoneRole.textContent = role.name;
    phoneSub.textContent = role.sub;
    visibleCount.textContent = role.count;
    if (role.cards.length === 0) {
      phoneCards.innerHTML = '<div class="p-empty"><svg class="ico"><use href="#i-lock"/></svg><b>No canvas</b><small>Public storefront remains visible</small></div>';
    } else {
      phoneCards.innerHTML = role.cards.map(cardMarkup).join("");
    }
    visibleStrip.classList.toggle("off", role.count === 0);
    keyGrant.classList.toggle("off", !role.grant);
    keyUseful.classList.toggle("off", !role.useful);
    keyGrant.querySelector(".key-dot").classList.toggle("off", !role.grant);
    keyUseful.querySelector(".key-dot").classList.toggle("off", !role.useful);
    const dots = [...eventDots.children];
    dots.forEach((d) => d.classList.remove("on-owner", "on-cashier"));
    dots.slice(0, 6).forEach((d) => d.classList.add("on-owner"));
    dots.slice(6, 8).forEach((d) => d.classList.add("on-cashier"));
    eventDots.dataset.role = roleKey;
  }

  document.querySelectorAll(".role-btn").forEach((b) => {
    b.addEventListener("click", () => renderRole(b.dataset.role));
  });
  renderRole("owner");

  const commitBtn = document.querySelector(".big-action");
  const gateRows = [...document.querySelectorAll(".gate-row")];
  const recordSlip = document.querySelector(".record-slip");
  const syncCards = [...document.querySelectorAll(".sync-card")];
  const undoBtn = document.querySelector(".undo-btn");
  let commitTimers = [];

  function clearCommitTimers() {
    commitTimers.forEach(clearTimeout);
    commitTimers = [];
  }

  function resetCommit() {
    clearCommitTimers();
    gateRows.forEach((r) => r.classList.remove("ok"));
    recordSlip.classList.remove("live");
    syncCards.forEach((c) => c.classList.remove("flash"));
    commitBtn.classList.remove("is-live");
    commitBtn.textContent = "New Counter Sale";
    undoBtn.classList.remove("show");
  }

  commitBtn.addEventListener("click", () => {
    if (commitBtn.classList.contains("is-live")) return;
    clearCommitTimers();
    gateRows.forEach((row, i) => {
      commitTimers.push(setTimeout(() => row.classList.add("ok"), 180 + i * 240));
    });
    commitTimers.push(setTimeout(() => {
      recordSlip.classList.add("live");
      commitBtn.classList.add("is-live");
      commitBtn.textContent = "Committed ✓";
      undoBtn.classList.add("show");
    }, 1320));
    syncCards.forEach((card, i) => {
      commitTimers.push(setTimeout(() => card.classList.add("flash"), 1450 + i * 100));
    });
  });
  undoBtn.addEventListener("click", resetCommit);

  const shapeData = {
    straight: { n: "01", title: "Straight", gate: "auto", who: "code", mod: "none", example: "send a report", steps: ["read", "deliver"], now: 1 },
    ask: { n: "02", title: "Ask", gate: "ask", who: "assignee", mod: "none", example: "count the drawer", steps: ["read", "count", "post"], now: 1 },
    approval: { n: "03", title: "Approval", gate: "approve", who: "owner", mod: "none", example: "approve a refund", steps: ["read", "approve", "write", "notify"], now: 1 },
    loop: { n: "04", title: "Loop", gate: "auto", who: "code", mod: "repeat", example: "chase every unpaid quote", steps: ["read", "message", "repeat"], now: 2 },
    batch: { n: "05", title: "Batch", gate: "auto", who: "code", mod: "repeat / row", example: "message every contact", steps: ["read list", "each row", "message"], now: 1 },
    reverse: { n: "06", title: "Reverse", gate: "approve", who: "owner", mod: "undo", example: "refund an invoice", steps: ["read", "write refund", "reverse"], now: 2 },
    retry: { n: "07", title: "Retry", gate: "auto / ask", who: "code", mod: "retry", example: "retry a failed action", steps: ["attempt", "fail", "retry"], now: 2 },
    reconcile: { n: "08", title: "Reconcile", gate: "auto", who: "code", mod: "match", example: "reconcile two reads", steps: ["read A", "read B", "match"], now: 2 }
  };
  const shapeTitle = document.getElementById("shapeTitle");
  const shapeIndex = document.getElementById("shapeIndex");
  const shapeGate = document.getElementById("shapeGate");
  const shapeWho = document.getElementById("shapeWho");
  const shapeMod = document.getElementById("shapeMod");
  const shapeExample = document.getElementById("shapeExample");
  const miniRun = document.getElementById("miniRun");
  const runShape = document.getElementById("runShape");

  function selectShape(key) {
    const s = shapeData[key];
    document.querySelectorAll(".shape").forEach((b) => b.classList.toggle("is-active", b.dataset.shape === key));
    shapeTitle.textContent = s.title;
    shapeIndex.textContent = s.n + " / 08";
    shapeGate.textContent = s.gate;
    shapeWho.textContent = s.who;
    shapeMod.textContent = s.mod;
    shapeExample.textContent = s.example;
    runShape.textContent = s.title.toLowerCase();
    miniRun.innerHTML = s.steps.map((step, i) => '<span class="mini-step ' + (i === s.now ? "now" : "") + '">' + step + '</span>').join('<span class="mini-arrow">→</span>');
  }
  document.querySelectorAll(".shape").forEach((b) => {
    b.addEventListener("click", () => selectShape(b.dataset.shape));
  });
  selectShape("approval");

  const ladderData = [
    { big: "L0", name: "Literal", who: "code", calls: "0", meter: 0, test: "Exact match to a known intent. <b>Compile.</b>" },
    { big: "L1", name: "Memory", who: "code + Jev", calls: "0–1", meter: 1, half: true, test: "Same shape as a saved plan. <b>Fill the slots.</b>" },
    { big: "L2", name: "Prose", who: "LLM", calls: "1", meter: 1, test: "The steps, in words. <b>Always go to L3.</b>" },
    { big: "L3", name: "Decide", who: "Jev", calls: "1 batched", meter: 1, test: "Pick tool, gate, modifier. <b>p and margin pass.</b>" },
    { big: "L4", name: "Verify", who: "Jev", calls: "1 batched", meter: 1, test: "Does each step match? <b>All yes.</b>" },
    { big: "L5", name: "Confirm", who: "human", calls: "0", meter: 0, test: "The owner approves the plan. <b>Compile.</b>" }
  ];
  const ladderBig = document.getElementById("ladderBig");
  const ladderName = document.getElementById("ladderName");
  const ladderWho = document.getElementById("ladderWho");
  const ladderCalls = document.getElementById("ladderCalls");
  const ladderTest = document.getElementById("ladderTest");
  const callMeter = document.getElementById("callMeter");

  function selectRung(i) {
    const r = ladderData[i];
    document.querySelectorAll(".rung").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.rung) === i));
    ladderBig.textContent = r.big;
    ladderName.textContent = r.name;
    ladderWho.textContent = r.who;
    ladderCalls.textContent = r.calls;
    ladderTest.innerHTML = r.test;
    callMeter.innerHTML = r.meter === 0 ? '<i></i><i></i>' : '<i class="' + (r.half ? "half" : "on") + '"></i><i></i>';
  }
  document.querySelectorAll(".rung").forEach((b) => {
    b.addEventListener("click", () => selectRung(Number(b.dataset.rung)));
  });
  selectRung(0);

  const gate = { booking: false, contact: false };
  const browser = document.getElementById("browser");
  const gateOverlay = document.getElementById("gateOverlay");
  const publishBtn = document.getElementById("publishBtn");
  const gateStepText = document.getElementById("gateStepText");
  const gateStepState = document.getElementById("gateStepState");
  const gateBuildStep = document.getElementById("gateBuildStep");
  const bookingSlot = document.getElementById("bookingSlot");
  const contactSlot = document.getElementById("contactSlot");
  let live = false;

  function renderGate() {
    const missing = (!gate.booking ? 1 : 0) + (!gate.contact ? 1 : 0);
    const ready = missing === 0;
    gateOverlay.classList.toggle("ready", ready || live);
    browser.classList.toggle("live", live);
    publishBtn.disabled = !ready || live;
    publishBtn.textContent = live ? "Live" : "Publish";
    bookingSlot.textContent = gate.booking ? "book a visit" : "booking —";
    contactSlot.textContent = gate.contact ? "+91 98401 23456" : "contact —";
    gateStepText.textContent = live ? "published · one tap unpublishes" : (ready ? "ready · one tap to publish" : missing + " things missing · draft is safe");
    gateStepState.textContent = live ? "live" : (ready ? "ready" : "draft");
    gateBuildStep.classList.toggle("now", !ready && !live);
    gateBuildStep.classList.toggle("done", ready || live);
    if (live) {
      gateOverlay.innerHTML = '<div class="gate-head"><span>Published</span><b>LIVE</b></div><div class="missing done"><span>Storefront is public</span><span>✓</span></div>';
      return;
    }
    if (ready) {
      gateOverlay.innerHTML = '<div class="gate-head"><span>Gate</span><b>ready</b></div><div class="missing done"><span>Booking service</span><span>✓</span></div><div class="missing done"><span>Contact phone</span><span>✓</span></div>';
      return;
    }
    gateOverlay.innerHTML = '<div class="gate-head"><span>Gate</span><b>' + missing + ' missing</b></div>' +
      '<div class="missing ' + (gate.booking ? "done" : "") + '"><span>Booking service</span>' + (gate.booking ? '<span>✓</span>' : '<button data-fix="booking">Add</button>') + '</div>' +
      '<div class="missing ' + (gate.contact ? "done" : "") + '"><span>Contact phone</span>' + (gate.contact ? '<span>✓</span>' : '<button data-fix="contact">Add</button>') + '</div>';
  }

  gateOverlay.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fix]");
    if (!btn) return;
    gate[btn.dataset.fix] = true;
    renderGate();
  });
  publishBtn.addEventListener("click", () => {
    if (publishBtn.disabled) return;
    live = true;
    renderGate();
  });
  document.getElementById("resetStore").addEventListener("click", () => {
    gate.booking = false;
    gate.contact = false;
    live = false;
    renderGate();
  });
  renderGate();

  const saleBtn = document.getElementById("saleBtn");
  const fanStage = document.getElementById("fanStage");
  const recCards = [...document.querySelectorAll(".rec-card")];
  const fanLinks = [...document.querySelectorAll(".fan-links line")];
  const onhandEl = document.getElementById("onhand");
  const reservedEl = document.getElementById("reserved");
  const availableEl = document.getElementById("available");
  const stockState = document.getElementById("stockState");
  const stockBar = document.getElementById("stockBar");
  const balanceBars = document.getElementById("balanceBars");
  const syncMini = [...document.querySelectorAll("#syncMini i")];
  const syncCount = document.getElementById("syncCount");
  let saleTimers = [];

  function clearSaleTimers() {
    saleTimers.forEach(clearTimeout);
    saleTimers = [];
  }

  function resetSale() {
    clearSaleTimers();
    recCards.forEach((c) => c.classList.remove("on"));
    fanLinks.forEach((l) => l.classList.remove("on"));
    balanceBars.classList.remove("balanced");
    syncMini.forEach((i) => i.classList.remove("on"));
    syncCount.textContent = "0 / 5";
    onhandEl.textContent = "12";
    reservedEl.textContent = "0";
    availableEl.textContent = "12";
    stockState.textContent = "before";
    stockBar.style.width = "100%";
    saleBtn.classList.remove("run");
    saleBtn.querySelector("small").textContent = "record a sale";
  }

  function runSale() {
    resetSale();
    saleBtn.classList.add("run");
    saleBtn.querySelector("small").textContent = "committing";
    const at = (ms, fn) => saleTimers.push(setTimeout(fn, ms));
    at(300, () => { recCards[0].classList.add("on"); fanLinks[0].classList.add("on"); });
    at(500, () => { recCards[1].classList.add("on"); fanLinks[1].classList.add("on"); });
    at(700, () => { recCards[2].classList.add("on"); fanLinks[2].classList.add("on"); });
    at(900, () => {
      recCards[3].classList.add("on"); fanLinks[3].classList.add("on");
      reservedEl.textContent = "2";
      availableEl.textContent = "10";
      stockState.textContent = "reserved";
      stockBar.style.width = "83.33%";
    });
    at(1120, () => {
      recCards[4].classList.add("on"); fanLinks[4].classList.add("on");
      balanceBars.classList.add("balanced");
    });
    at(1340, () => { recCards[5].classList.add("on"); fanLinks[5].classList.add("on"); });
    at(1560, () => {
      onhandEl.textContent = "10";
      reservedEl.textContent = "0";
      availableEl.textContent = "10";
      stockState.textContent = "fulfilled";
      syncMini.forEach((i) => i.classList.add("on"));
      syncCount.textContent = "5 / 5";
    });
    at(1900, () => {
      saleBtn.classList.remove("run");
      saleBtn.querySelector("small").textContent = "record another sale";
    });
  }
  saleBtn.addEventListener("click", runSale);
  resetSale();

  const hash = location.hash.replace("#", "");
  const start = meta.findIndex((m) => m.id === hash);
  if (start >= 0) showScene(start, false);

  window.addEventListener("hashchange", () => {
    const i = meta.findIndex((m) => m.id === location.hash.replace("#", ""));
    if (i >= 0 && i !== current) showScene(i, false);
  });
})();

