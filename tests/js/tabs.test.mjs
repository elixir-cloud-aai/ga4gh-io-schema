// SPDX-FileCopyrightText: 2026 ELIXIR On-Cloud <cloud-service@elixir-europe.org>
// SPDX-License-Identifier: Apache-2.0

// Tests the logic of the tabs of the demo page (prototype/host/tabs.js),
// without a browser: which tab a URL fragment opens, which fragment keeps a
// tab open, and where the keys move. tests/test_prototype_e2e.py tests the
// tabs in a browser.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { hashOfTab, tabOfHash, tabOfKey } from "../../prototype/host/tabs.js";

const NAMES = ["inputs", "outputs"];

describe("URL fragment", () => {
  test("opens the tab it names", () => {
    assert.equal(tabOfHash("#outputs", NAMES), "outputs");
    assert.equal(tabOfHash("#inputs", NAMES), "inputs");
  });

  test("opens the first tab without a fragment", () => {
    assert.equal(tabOfHash("", NAMES), "inputs");
    assert.equal(tabOfHash("#", NAMES), "inputs");
  });

  test("opens the first tab for unknown or malformed fragments", () => {
    assert.equal(tabOfHash("#nothing", NAMES), "inputs");
    assert.equal(tabOfHash("#Outputs", NAMES), "inputs");
    assert.equal(tabOfHash("#%", NAMES), "inputs");
  });

  test("keeps a tab open, the first without a fragment", () => {
    assert.equal(hashOfTab("outputs", NAMES), "#outputs");
    assert.equal(hashOfTab("inputs", NAMES), "");
  });

  test("round-trips through the fragment", () => {
    for (const name of NAMES) assert.equal(tabOfHash(hashOfTab(name, NAMES), NAMES), name);
  });
});

describe("keys", () => {
  test("arrows move to the next and previous tab, wrapping around", () => {
    assert.equal(tabOfKey("ArrowRight", "inputs", NAMES), "outputs");
    assert.equal(tabOfKey("ArrowRight", "outputs", NAMES), "inputs");
    assert.equal(tabOfKey("ArrowLeft", "outputs", NAMES), "inputs");
    assert.equal(tabOfKey("ArrowLeft", "inputs", NAMES), "outputs");
  });

  test("Home and End move to the first and last tab", () => {
    const three = ["a", "b", "c"];
    assert.equal(tabOfKey("Home", "c", three), "a");
    assert.equal(tabOfKey("End", "a", three), "c");
    assert.equal(tabOfKey("ArrowRight", "a", three), "b");
  });

  test("other keys don't move", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Enter", " ", "Tab", "a"]) {
      assert.equal(tabOfKey(key, "inputs", NAMES), null);
    }
  });
});
