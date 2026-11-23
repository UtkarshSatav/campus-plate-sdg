import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:8000/";
const output = process.argv[3] ?? "screenshots";
const listingTitle = "Green Campus Workshop";
await mkdir(output, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.clock.install();
  await page.goto(base);
  await page.getByRole("heading", { name: "Free meals on campus." }).waitFor();
  assert.equal(await page.locator(".card").count(), 3);
  await page.screenshot({ path: `${output}/01-student-pickup-board.png`, fullPage: true });

  await page.getByRole("link", { name: "Organizer", exact: true }).click();
  await page.getByLabel("Event name").fill(listingTitle);
  await page.getByLabel("Meal and dietary details").fill("Vegetable rice bowls · Vegetarian");
  await page.getByLabel("Pickup location").fill("Student Union · Room 204");
  await page.getByLabel("Portions").fill("20");
  await page.getByLabel("Closes in").selectOption("15");
  await page.getByRole("button", { name: "Publish pickup" }).click();
  await page.getByText("20 available · 0 reserved · 0 collected", { exact: true }).waitFor();

  await page.getByRole("link", { name: "Student", exact: true }).click();
  const listing = page.locator(".card").filter({ hasText: listingTitle });
  const reserve = listing.getByRole("button", { name: "Reserve a portion" });
  await reserve.click();
  await page.getByText("19 left", { exact: true }).waitFor();
  assert.equal(await listing.getByRole("button", { name: "Reserved", exact: true }).isDisabled(), true);
  const code = await page.locator(".code").innerText();
  assert.match(code, /^[A-Z2-9]{6}$/);
  await page.reload();
  await page.getByText(code, { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/02-student-reservation-pass.png`, fullPage: true });

  await page.getByRole("link", { name: "Organizer", exact: true }).click();
  await page.getByLabel("Student pickup code").fill(code.toLowerCase());
  await page.getByRole("button", { name: "Confirm pickup" }).click();
  await page.getByText("Pickup confirmed for Green Campus Workshop. 1 portion collected.", { exact: true }).waitFor();
  assert.equal(await page.locator("#collected-total").innerText(), "1");
  await page.screenshot({ path: `${output}/03-organizer-collection.png`, fullPage: true });

  await page.getByLabel("Student pickup code").fill(code);
  await page.getByRole("button", { name: "Confirm pickup" }).click();
  await page.getByText("This code has already been used.", { exact: true }).waitFor();
  assert.equal(await page.locator("#collected-total").innerText(), "1");

  await page.getByRole("link", { name: "Student", exact: true }).click();
  const design = page.locator(".card").filter({ hasText: "Design Society Meetup" });
  const reserveDesign = design.getByRole("button", { name: "Reserve a portion" });
  await reserveDesign.click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await design.getByText("8 left", { exact: true }).waitFor();
  await reserveDesign.click();
  const expiredCode = await page.locator(".code").innerText();
  await page.clock.fastForward(5 * 60 * 1000 + 1000);
  await page.locator(".code").waitFor({ state: "hidden" });
  await design.getByText("8 left", { exact: true }).waitFor();

  await page.getByRole("link", { name: "Organizer", exact: true }).click();
  await page.getByLabel("Student pickup code").fill(expiredCode);
  await page.getByRole("button", { name: "Confirm pickup" }).click();
  await page.getByText("This pickup code is no longer active.", { exact: true }).waitFor();
  await page.clock.fastForward(11 * 60 * 1000);
  await page.getByRole("link", { name: "Student", exact: true }).click();
  await listing.waitFor({ state: "hidden" });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(pageErrors, []);
  console.log("Verified posting, reservation, reload, collection, code reuse, cancellation, expiry, closing and mobile layout.");
} finally {
  await browser.close();
}
