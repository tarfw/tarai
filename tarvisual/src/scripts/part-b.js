(() => {
  const groups = {
    b0: {
      kicker: 'Part B / B0 · Setup',
      title: 'Three screens to a working Canvas.',
      intro: 'A description becomes a workspace. Jev proposes the cards; the owner confirms. Every screen is a read or one commit.'
    },
    b1: {
      kicker: 'Part B / B1 · Canvas — owner',
      title: 'Six cards. One next action.',
      intro: 'The owner sees an alert, the next action, then the stack. The same Canvas for every role, filtered by grants.'
    },
    b2: {
      kicker: 'Part B / B2 · Canvas — staff',
      title: 'Four cards. One shift.',
      intro: 'Staff see the same Canvas through a narrower grant. The Inbox tells them what to do next.'
    },
    b3: {
      kicker: 'Part B / B3 · Card',
      title: 'A saved read. One tap.',
      intro: 'Tap the title for detail. Tap the button to commit once. Other actions live inside the card.'
    },
    b4: {
      kicker: 'Part B / B4 · Flow run',
      title: 'One run. One step at a time.',
      intro: 'Done, now, waiting. One primary tap advances the run and writes one record.'
    },
    b5: {
      kicker: 'Part B / B5 · Checkout',
      title: 'One sale. One commit.',
      intro: 'Order, invoice, payment and stock are written together. Money needs one confirm.'
    },
    b6: {
      kicker: 'Part B / B6 · Canvas details',
      title: 'The detail behind every card.',
      intro: 'Add cards, describe products, inspect the store and name variants. Jev names dimensions; code computes rows.'
    },
    b7: {
      kicker: 'Part B / B7 · Store site',
      title: 'Describe once. Gate. Publish.',
      intro: 'Two web surfaces over one kernel: the merchant builds and publishes; the customer browses and orders.'
    },
    b8: {
      kicker: 'Part B / B8 · Business manager',
      title: 'Every stage, one manager.',
      intro: 'A stage is a tag for the Business Manager. Every capability is a CRUD action.'
    },
    b9: {
      kicker: 'Part B / B9 · Inbox',
      title: 'One event. One card. One tap.',
      intro: 'Inbox is mandatory for every member. One event routes to the right person.'
    }
  };

  const screens = [...document.querySelectorAll('.b-scene')];
  const groupButtons = [...document.querySelectorAll('#bNav .nav-item')];
  const indexList = document.getElementById('bIndexList');
  const indexCount = document.getElementById('bIndexCount');
  const notes = document.getElementById('bNotes');
  const kicker = document.getElementById('bKicker');
  const title = document.getElementById('bTitle');
  const intro = document.getElementById('bIntroText');
  const work = document.getElementById('bWork');
  const nav = document.getElementById('bNav');
  let currentId = screens[0]?.dataset.screen;
  let currentGroup = null;

  if (!screens.length) return;

  function centerActiveNav() {
    if (!nav) return;
    if (window.innerWidth > 960) return;
    const active = nav.querySelector('.nav-item.is-active');
    if (!active) return;
    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const target = nav.scrollLeft + activeRect.left - navRect.left - (nav.clientWidth - activeRect.width) / 2;
    nav.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }

  function centerActiveIndex() {
    if (window.innerWidth > 1180) return;
    const active = indexList?.querySelector('.b-index-item.is-active');
    if (!active || !indexList) return;
    const listRect = indexList.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (indexList.scrollWidth <= indexList.clientWidth) return;
    const target = indexList.scrollLeft + activeRect.left - listRect.left - (indexList.clientWidth - activeRect.width) / 2;
    indexList.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }

  function buildIndex(groupKey) {
    const groupScreens = screens.filter((screen) => screen.dataset.group === groupKey);
    indexList.innerHTML = groupScreens.map((screen) => {
      const active = screen.dataset.screen === currentId ? ' is-active' : '';
      return '<button class="b-index-item' + active + '" data-screen="' + screen.dataset.screen + '" data-kind="' + screen.dataset.kind + '">' +
        '<span class="idx">' + screen.dataset.n + '</span>' +
        '<span class="name">' + screen.dataset.label + '</span>' +
        '<span class="dot"></span>' +
        '</button>';
    }).join('');
    indexCount.textContent = String(groupScreens.length).padStart(2, '0');
  }

  function renderGroup(groupKey) {
    const group = groups[groupKey];
    if (!group) return;
    groupButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.group === groupKey));
    kicker.textContent = group.kicker;
    title.textContent = group.title;
    intro.textContent = group.intro;
    buildIndex(groupKey);
    centerActiveNav();
    centerActiveIndex();
  }

  function renderNotes(screen) {
    const kind = screen.dataset.kind;
    notes.innerHTML =
      '<div class="note-head"><span class="note-code">Screen ' + screen.dataset.code + '</span><span class="note-kind">' + kind + '</span></div>' +
      '<h2>' + screen.dataset.name + '</h2>' +
      '<p>' + screen.dataset.note + '</p>' +
      '<dl class="note-list">' +
        '<div><dt>Who</dt><dd>' + screen.dataset.who + '</dd></div>' +
        '<div><dt>Primary tap</dt><dd>' + screen.dataset.tap + '</dd></div>' +
        '<div><dt>Commit</dt><dd>' + screen.dataset.commit + '</dd></div>' +
      '</dl>' +
      '<div class="note-rule"><i></i><span>One pattern · title + up to 2 live metrics + one primary tap</span></div>';
  }

  function updateIndexActive() {
    indexList.querySelectorAll('.b-index-item').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.screen === currentId);
    });
    centerActiveIndex();
  }

  function showScreen(id, push = true) {
    const next = screens.find((screen) => screen.dataset.screen === id);
    if (!next) return;
    currentId = next.dataset.screen;
    const nextGroup = next.dataset.group;
    screens.forEach((screen) => screen.classList.toggle('is-active', screen === next));
    if (nextGroup !== currentGroup) {
      currentGroup = nextGroup;
      renderGroup(nextGroup);
    } else {
      updateIndexActive();
    }
    work.dataset.kind = next.dataset.kind;
    renderNotes(next);
    if (push !== false) {
      history.replaceState(null, '', '#' + currentId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    centerActiveNav();
  }

  groupButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const first = screens.find((screen) => screen.dataset.group === button.dataset.group);
      if (first) showScreen(first.dataset.screen);
    });
  });

  indexList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-screen]');
    if (button) showScreen(button.dataset.screen);
  });

  document.getElementById('bPrev').addEventListener('click', () => {
    const index = screens.findIndex((screen) => screen.dataset.screen === currentId);
    showScreen(screens[(index - 1 + screens.length) % screens.length].dataset.screen);
  });

  document.getElementById('bNext').addEventListener('click', () => {
    const index = screens.findIndex((screen) => screen.dataset.screen === currentId);
    showScreen(screens[(index + 1) % screens.length].dataset.screen);
  });

  document.addEventListener('keydown', (event) => {
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return;
    if (event.key === 'ArrowRight') {
      const index = screens.findIndex((screen) => screen.dataset.screen === currentId);
      showScreen(screens[(index + 1) % screens.length].dataset.screen);
    }
    if (event.key === 'ArrowLeft') {
      const index = screens.findIndex((screen) => screen.dataset.screen === currentId);
      showScreen(screens[(index - 1 + screens.length) % screens.length].dataset.screen);
    }
  });

  const startId = location.hash.replace('#', '');
  const start = screens.find((screen) => screen.dataset.screen === startId);
  showScreen(start ? start.dataset.screen : screens[0].dataset.screen, false);
  history.replaceState(null, '', '#' + currentId);

  window.addEventListener('hashchange', () => {
    const id = location.hash.replace('#', '');
    if (id && id !== currentId) showScreen(id, false);
  });

  window.addEventListener('resize', () => {
    centerActiveNav();
    centerActiveIndex();
  });
})();
