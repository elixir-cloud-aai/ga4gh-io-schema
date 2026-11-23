// SPDX-FileCopyrightText: 2026 ELIXIR On-Cloud <cloud-service@elixir-europe.org>
// SPDX-License-Identifier: Apache-2.0

// The tabs of the page (Inputs and Outputs), after the tab pattern of the
// ARIA Authoring Practices Guide: a `tablist` of `tab` buttons, each
// controlling a `tabpanel`. Arrow keys, Home and End move between the tabs
// and open them; only the open tab is in the tab order. The open tab is
// kept in the URL fragment (`#outputs`; no fragment for the first tab), so
// that a reload or a link opens it again. The pure functions are tested in
// `tests/js/tabs.test.mjs`, the page in `tests/test_prototype_e2e.py`.

/**
 * Return the name of the tab that a URL fragment opens.
 *
 * @param {string} hash The fragment, with its `#` (as `location.hash`).
 * @param {Array<string>} names The names of the tabs, in order.
 * @returns {string} The tab named by the fragment, else the first tab.
 */
export function tabOfHash(hash, names) {
  let name;
  try {
    name = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    // A malformed escape, e.g. `#%`
    return names[0];
  }
  return names.includes(name) ? name : names[0];
}

/**
 * Return the URL fragment that keeps a tab open.
 *
 * @param {string} name The name of the tab.
 * @param {Array<string>} names The names of the tabs, in order.
 * @returns {string} `#` and the name, or an empty string for the first tab.
 */
export function hashOfTab(name, names) {
  return name === names[0] ? "" : `#${encodeURIComponent(name)}`;
}

/**
 * Return the tab that a key moves to.
 *
 * @param {string} key The key (as `KeyboardEvent.key`).
 * @param {string} current The name of the focused tab.
 * @param {Array<string>} names The names of the tabs, in order.
 * @returns {string|null} The tab to move to (wrapping around at the ends),
 *   or `null` for keys that don't move between tabs.
 */
export function tabOfKey(key, current, names) {
  const index = names.indexOf(current);
  switch (key) {
    case "ArrowRight":
      return names[(index + 1) % names.length];
    case "ArrowLeft":
      return names[(index - 1 + names.length) % names.length];
    case "Home":
      return names[0];
    case "End":
      return names[names.length - 1];
    default:
      return null;
  }
}

/**
 * Wire up the tabs of a tab list and open the tab of the URL fragment.
 *
 * Each tab is an element with `role="tab"`, a `data-tab` name and
 * `aria-controls` naming its panel.
 *
 * @param {Element} tablist The element with `role="tablist"`.
 * @param {Window} view The window, for its location and history.
 * @returns {void}
 */
export function setUpTabs(tablist, view = window) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const names = tabs.map((tab) => tab.dataset.tab);
  const open = (name, { focus = false, keep = true } = {}) => {
    for (const tab of tabs) {
      const selected = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.ownerDocument.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
      if (selected && focus) tab.focus();
    }
    if (keep) {
      // Replaced, not pushed: switching tabs adds no history entries; the
      // query (the picked workflow) stays as it is
      const { pathname, search } = view.location;
      view.history.replaceState(view.history.state, "", `${pathname}${search}${hashOfTab(name, names)}`);
    }
  };
  for (const tab of tabs) {
    tab.addEventListener("click", () => open(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      const name = tabOfKey(event.key, tab.dataset.tab, names);
      if (name === null) return;
      event.preventDefault();
      open(name, { focus: true });
    });
  }
  // A link to the page with another fragment, or back and forward
  view.addEventListener("hashchange", () => open(tabOfHash(view.location.hash, names), { keep: false }));
  open(tabOfHash(view.location.hash, names), { keep: false });
}
