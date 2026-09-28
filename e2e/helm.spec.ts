import { expect, test, type Page } from "@playwright/test";
import { MOCK, mockClaudeRoutes } from "./mocks";

/**
 * Walks the Harvest → Prune → Practice → Recognize loop through the UI with
 * the Claude routes mocked. Seeds, pipeline, store and components run for real.
 */

async function open(page: Page, persona: "backend" | "maritime" = "backend") {
  await mockClaudeRoutes(page);
  await page.addInitScript((p) => {
    // Fresh seed every test: drop persisted state and pin the persona.
    window.localStorage.clear();
    window.localStorage.setItem("helm:persona", p);
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
    const offer = page.getByTestId(/^beat-offer-/).last();
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
    const card = page.getByTestId(/^recognition-/).filter({ hasText: "Evidence" }).last();
    await expect(card).toBeVisible();
    await expect(card).toContainText("evidence you understand");
    await card.getByTestId("recognition-confirm").click();
    await expect(page.getByText(/Recognized:/).last()).toBeVisible();
  });

  test("a rejected recognition offers the three reasons", async ({ page }) => {
    await open(page);
    await send(page, `Use a ${MOCK.recognizePhrase} here.`);
    const card = page.getByTestId(/^recognition-/).filter({ hasText: "Evidence" }).last();
    await expect(card).toBeVisible();
    await card.getByTestId("recognition-reject").click();
    await expect(card.getByTestId("recognition-reason-copied")).toBeVisible();
    await expect(card.getByTestId("recognition-reason-already-knew")).toBeVisible();
    await expect(card.getByTestId("recognition-reason-not-the-concept")).toBeVisible();
    await card.getByTestId("recognition-reason-copied").click();
    await expect(card).toBeHidden();
    // "I copied a pattern" routes back into harvest as a Beat offer.
    await expect(page.getByTestId(/^beat-offer-/).last()).toBeVisible();
  });

  test("kicking off long work offers Studio for the wait", async ({ page }) => {
    await open(page);
    await page.getByTestId("work-longtask").click();
    await expect(page.getByTestId("longtask-strip")).toBeVisible();
    const offer = page.getByTestId(/^studio-offer-/).last();
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
