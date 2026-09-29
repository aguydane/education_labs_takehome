import { expect, test, type Page } from "@playwright/test";
import { MOCK, mockClaudeRoutes } from "./mocks";

/**
 * Walks the Harvest → Prune → Practice → Recognize loop through the UI with
 * the Claude routes mocked. Seeds, pipeline, store and components run for real.
 */

async function open(page: Page, persona: "backend" | "maritime" = "backend") {
  await mockClaudeRoutes(page);
  await page.addInitScript((p) => {
    // Fresh seed once per test (contexts are per test, so sessionStorage is too):
    // drop persisted state, pin the persona, skip the walkthrough. Reloads keep state.
    if (window.sessionStorage.getItem("helm:test-cleared")) return;
    window.localStorage.clear();
    window.localStorage.setItem("helm:persona", p);
    window.localStorage.setItem("helm:tour", JSON.stringify({ done: true }));
    window.sessionStorage.setItem("helm:test-cleared", "1");
  }, persona);
  await page.goto("/");
  await expect(page.getByTestId("work-panel")).toBeVisible();
  await expect(page.getByTestId("graph-panel")).toBeVisible();
}

async function send(page: Page, message: string) {
  const composer = page.getByTestId("work-composer");
  await composer.fill(message);
  await page.getByTestId("work-send").click();
}

test.describe("Helm", () => {
  test("the walkthrough runs the whole loop on the real app", async ({ page }) => {
    await mockClaudeRoutes(page);
    // A first visit: nothing in storage. Only clear once so reloads keep progress.
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem("helm:test-cleared")) {
        window.localStorage.clear();
        window.sessionStorage.setItem("helm:test-cleared", "1");
      }
    });
    await page.goto("/");
    const card = page.getByTestId("tour-card");
    const atStep = async (id: string) => expect(card).toHaveAttribute("data-step", id);

    await atStep("welcome");
    await card.getByTestId("tour-start").click();

    await atStep("send-why");
    await card.getByTestId("tour-send").click();
    await atStep("chips");
    await page.locator('[data-testid^="concept-chip-"]').last().click();
    await atStep("popover");
    await page.getByTestId("chip-beat").click();
    await atStep("beat");
    await page.getByTestId("beat-answer").fill("I'd move the range column last.");
    await page.getByTestId("beat-reply").click();
    await atStep("map");
    await page.getByTestId("beat-close").click();
    await page.getByTestId("prune-button").click();
    await atStep("proposal");
    await page.getByTestId("prune-accept").click();
    await atStep("long-task");
    await page.getByTestId("work-longtask").click();
    await atStep("studio-offer");
    await page.getByTestId("studio-offer-book").click();
    await atStep("studio");
    await page.getByTestId("studio-composer").fill("carrier_id and status, then created_at for the sort.");
    await page.getByTestId("studio-send").click();
    await atStep("studio-close");
    await page.getByTestId("studio-back").click();
    await page.getByTestId("studio-closing-input").fill("I'd say which columns the index has to cover.");
    await page.getByTestId("studio-closing-submit").click();
    await atStep("recognize");
    // "or write your own": a message the mocked recognizer treats as evidence.
    await send(page, `Add a ${MOCK.recognizePhrase} on status where it is not null and check the planner uses it.`);
    await atStep("confirm");
    await page.getByTestId("recognition-confirm").click();
    await atStep("done");
    await card.getByTestId("tour-finish").click();
    await expect(card).toBeHidden();

    // Finished stays finished across a reload; the header can start it again.
    await page.reload();
    await expect(page.getByTestId("work-panel")).toBeVisible();
    await expect(card).toBeHidden();
    await page.getByTestId("header-walkthrough").click();
    await atStep("welcome");
    await card.getByTestId("tour-skip").click();
    await expect(card).toBeHidden();
  });

  test("the walkthrough can run as Eli", async ({ page }) => {
    await open(page);
    await page.getByTestId("header-walkthrough").click();
    const card = page.getByTestId("tour-card");
    await expect(card).toHaveAttribute("data-step", "welcome");
    await card.getByTestId("tour-start-maritime").click();
    await expect(card).toHaveAttribute("data-step", "send-why");
    await expect(card).toContainText("as Eli");
    await expect(card).toContainText("McCorpen");
    await expect(page.getByTestId("persona-maritime")).toHaveAttribute("aria-selected", "true");
    await card.getByTestId("tour-send").click();
    await expect(card).toHaveAttribute("data-step", "chips");
    await card.getByTestId("tour-skip").click();
    await expect(card).toBeHidden();
  });

  test("loads a seeded persona with history and a map", async ({ page }) => {
    await open(page);
    const exchanges = page.locator('[data-testid^="exchange-"]');
    await expect(exchanges.first()).toBeVisible();
    expect(await exchanges.count()).toBeGreaterThanOrEqual(10);
    await expect(page.getByTestId("graph-canvas")).toBeVisible();
    expect(await page.locator('[data-testid^="graph-node-"]').count()).toBeGreaterThanOrEqual(8);
    await expect(page.getByTestId("active-set-strip")).toBeVisible();
    await expect(page.getByTestId("calendar-strip")).toBeVisible();
  });

  test("work exchange is harvested into concept chips", async ({ page }) => {
    await open(page);
    await send(page, "Make this query faster please.");
    await expect(page.getByText(MOCK.chatReply)).toBeVisible();
    const chip = page.getByTestId(/^concept-chip-/).last();
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.getByTestId("chip-popover")).toBeVisible();
    await expect(page.getByTestId("chip-know")).toBeVisible();
    await expect(page.getByTestId("chip-delegate")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("a why-question is a learning bid that opens a Beat", async ({ page }) => {
    await open(page);
    await send(page, "Why did you pick a composite index over two single ones?");
    await expect(page.getByText(MOCK.chatReply)).toBeVisible();
    const offer = page.getByTestId(/^beat-offer-nudge_/).last();
    await expect(offer).toBeVisible();
    await offer.getByTestId("beat-offer-take").click();
    const overlay = page.getByTestId("beat-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay.getByTestId("beat-content")).toContainText("column order");
    await overlay.getByTestId("beat-answer").fill("I'd move the range column last.");
    await overlay.getByTestId("beat-reply").click();
    await expect(overlay).toContainText("Noted.");
    await overlay.getByTestId("beat-close").click();
    await expect(overlay).toBeHidden();
  });

  test("prune proposes an active set and the learner decides", async ({ page }) => {
    await open(page);
    await page.getByTestId("prune-button").click();
    const panel = page.getByTestId("prune-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("continuity");
    await panel.getByTestId("prune-accept").click();
    await expect(panel).toBeHidden();
    expect(await page.locator('[data-testid^="active-chip-"]').count()).toBeGreaterThanOrEqual(1);
  });

  test("a sharpened prompt earns a recognition the learner confirms", async ({ page }) => {
    await open(page);
    await send(page, `Add a ${MOCK.recognizePhrase} on status where it is not null and check the planner uses it.`);
    const card = page.getByTestId(/^recognition-rec_/).last();
    await expect(card).toBeVisible();
    await expect(card).toContainText("evidence you understand");
    await card.getByTestId("recognition-confirm").click();
    await expect(page.getByText(/Recognized:/).last()).toBeVisible();
  });

  test("a rejected recognition offers the three reasons", async ({ page }) => {
    await open(page);
    await send(page, `Use a ${MOCK.recognizePhrase} here.`);
    const card = page.getByTestId(/^recognition-rec_/).last();
    await expect(card).toBeVisible();
    await card.getByTestId("recognition-reject").click();
    await expect(card.getByTestId("recognition-reason-copied")).toBeVisible();
    await expect(card.getByTestId("recognition-reason-already-knew")).toBeVisible();
    await expect(card.getByTestId("recognition-reason-not-the-concept")).toBeVisible();
    await card.getByTestId("recognition-reason-copied").click();
    await expect(card).toBeHidden();
    // "I copied a pattern" routes back into harvest as a Beat offer.
    await expect(page.getByTestId(/^beat-offer-nudge_/).last()).toBeVisible();
  });

  test("kicking off long work offers Studio for the wait", async ({ page }) => {
    await open(page);
    await page.getByTestId("work-longtask").click();
    await expect(page.getByTestId("longtask-strip")).toBeVisible();
    const offer = page.getByTestId(/^studio-offer-nudge_/).last();
    await expect(offer).toBeVisible();
    await offer.getByTestId("studio-offer-book").click();

    const studio = page.getByTestId("studio-view");
    await expect(studio).toBeVisible();
    await expect(studio.getByTestId("studio-messages")).toContainText("your own query");
    await studio.getByTestId("studio-composer").fill("It needs carrier_id and status, then created_at for the sort.");
    await studio.getByTestId("studio-send").click();
    await expect(studio.getByTestId("studio-messages")).toContainText(MOCK.studioReply);
    await studio.getByTestId("studio-more-help").click();
    await expect(studio.getByTestId("studio-rung")).toContainText(/modeling|coaching/i);

    await studio.getByTestId("studio-back").click();
    await studio.getByTestId("studio-closing-input").fill("I'd say which columns the index has to cover.");
    await studio.getByTestId("studio-closing-submit").click();
    await expect(page.getByTestId("work-panel")).toBeVisible();
  });

  test("scheduled Studio saves where you were", async ({ page }) => {
    await open(page);
    await page.getByTestId("calendar-jump").click();
    const studio = page.getByTestId("studio-view");
    await expect(studio).toBeVisible();
    await expect(studio.getByTestId("studio-summary")).toContainText("shipment_events");
    await studio.getByTestId("studio-back").click();
    await studio.getByTestId("studio-leave").click();
    await expect(page.getByTestId("work-panel")).toBeVisible();
  });

  test("graph collapses to a rail that keeps the active set", async ({ page }) => {
    await open(page);
    await page.getByTestId("graph-toggle").first().click();
    await expect(page.getByTestId("graph-rail")).toBeVisible();
    await expect(page.getByTestId("rail-studio")).toBeVisible();
    expect(await page.locator('[data-testid^="rail-chip-"]').count()).toBeGreaterThanOrEqual(1);
    await page.getByTestId("graph-toggle").first().click();
    await expect(page.getByTestId("graph-canvas")).toBeVisible();
  });

  test("concept detail exposes the learner's controls", async ({ page }) => {
    await open(page);
    await page.locator('[data-testid^="graph-node-"]').first().click();
    const detail = page.getByTestId("concept-detail");
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId("detail-know")).toBeVisible();
    await expect(detail.getByTestId("detail-delegate")).toBeVisible();
    await expect(detail.getByTestId("detail-studio")).toBeVisible();
    await detail.getByTestId("detail-know").click();
    await expect(detail).toContainText(/high/i);
    await detail.getByTestId("detail-close").click();
    await expect(detail).toBeHidden();
  });

  test("the learner can draw an edge between two concepts and inspect it", async ({ page }) => {
    await open(page);
    await page.locator('[data-testid^="graph-node-"]').first().click();
    const detail = page.getByTestId("concept-detail");
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId("detail-connections")).toBeVisible();

    const target = detail.getByTestId("detail-link-target");
    await target.selectOption({ index: 1 });
    const targetId = await target.inputValue();
    await detail.getByTestId("detail-link-add").click();
    await expect(detail.getByTestId("detail-connections")).toContainText("you drew");

    // The edge is on the map and can be removed from the connections list.
    await expect(page.locator(`[data-testid="graph-node-${targetId}"]`)).toBeVisible();
    await detail.getByTestId("detail-connections").getByRole("button", { name: /remove/i }).first().click();
    await expect(detail.getByTestId("detail-connections")).not.toContainText("you drew");
  });

  test("the learner can journal on an idea and Studio sees it", async ({ page }) => {
    await open(page);
    await page.locator('[data-testid^="graph-node-"]').first().click();
    const detail = page.getByTestId("concept-detail");
    await detail.getByTestId("detail-note-input").fill("I keep confusing this with the sort column rule.");
    await detail.getByTestId("detail-note-add").click();
    const note = detail.getByTestId(/^detail-note-note_/).first();
    await expect(note).toContainText("confusing this");
    // The note is part of the concept, so it survives a reload.
    await page.reload();
    await page.locator('[data-testid^="graph-node-"]').first().click();
    await expect(page.getByTestId("concept-detail")).toContainText("confusing this");
    await page.getByTestId("concept-detail").getByTestId("detail-note-remove").first().click();
    await expect(page.getByTestId("concept-detail")).not.toContainText("confusing this");
  });

  test("an edge card explains why two ideas meet and takes notes", async ({ page }) => {
    await open(page);
    await page.locator('[data-testid^="graph-edge-"]').first().dispatchEvent("click");
    const edge = page.getByTestId("edge-detail");
    await expect(edge).toBeVisible();
    await expect(edge).toContainText("My guess:");
    await edge.getByTestId("edge-note-input").fill("These two are really the same decision.");
    await edge.getByTestId("edge-note-add").click();
    await expect(edge.getByTestId(/^edge-note-note_/).first()).toContainText("same decision");
  });

  test("studio time can be scheduled, listed, and past sessions reopened", async ({ page }) => {
    await open(page);
    // The seed has one block and one past session. The list is behind a toggle below the map.
    await page.getByTestId("calendar-studio-toggle").click();
    await expect(page.getByTestId("calendar-strip")).toContainText(/Upcoming/i);
    await page.getByTestId("calendar-add").click();
    await page.getByTestId("calendar-add-day").selectOption({ index: 2 });
    await page.getByTestId("calendar-add-time").fill("09:30");
    await page.getByTestId("calendar-add-submit").click();
    expect(await page.locator('[data-testid^="calendar-remove-"]').count()).toBeGreaterThanOrEqual(2);

    const history = page.locator('[data-testid^="history-studio_"]').first();
    await expect(history).toBeVisible();
    await history.click();
    const viewer = page.getByTestId("session-viewer");
    await expect(viewer).toBeVisible();
    await viewer.getByTestId("session-resume").click();
    const studio = page.getByTestId("studio-view");
    await expect(studio).toBeVisible();
    await studio.getByTestId("studio-composer").fill("Picking this back up: what would I check first?");
    await studio.getByTestId("studio-send").click();
    await expect(studio.getByTestId("studio-messages")).toContainText(MOCK.studioReply);
    await studio.getByTestId("studio-back").click();
    await studio.getByTestId("studio-leave").click();
    await expect(page.getByTestId("work-panel")).toBeVisible();
  });

  test("the dock can expand into a full-height column beside the map", async ({ page }) => {
    await open(page);
    await page.locator('[data-testid^="graph-node-"]').first().click();
    const detail = page.getByTestId("concept-detail");
    await expect(detail).toBeVisible();
    await page.getByTestId("dock-focus").click();
    await expect(page.getByTestId("graph-region")).toHaveAttribute("data-focused", "true");
    await expect(detail).toBeVisible();
    await expect(page.getByTestId("graph-canvas")).toBeVisible();
    // The column is the learner's layout choice: closing the detail keeps it.
    await detail.getByTestId("detail-close").click();
    await expect(page.getByTestId("graph-region")).toHaveAttribute("data-focused", "true");
    await page.getByTestId("dock-unfocus").click();
    await expect(page.getByTestId("graph-region")).toHaveAttribute("data-focused", "false");
  });

  test("the page itself never scrolls", async ({ page }) => {
    await open(page);
    await page.setViewportSize({ width: 1000, height: 560 });
    await page.evaluate(() => {
      window.scrollTo(0, 800);
      (document.querySelector('[data-testid="prune-button"]') as HTMLElement | null)?.focus();
    });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(560);
  });

  test("switching persona loads a different history; reset restores the seed", async ({ page }) => {
    await open(page);
    const before = await page.locator('[data-testid^="exchange-"]').first().textContent();
    await page.getByTestId("persona-maritime").click();
    await expect(page.getByTestId("work-panel")).toBeVisible();
    const after = await page.locator('[data-testid^="exchange-"]').first().textContent();
    expect(after).not.toEqual(before);

    await send(page, "Draft the discovery requests, thanks.");
    await expect(page.getByText(MOCK.chatReply)).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("reset-persona").click();
    await expect(page.getByText(MOCK.chatReply)).toBeHidden();
  });
});
