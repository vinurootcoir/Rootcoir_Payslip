import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppError } from "../src/components/app-error";
import { NotFoundScreen } from "../src/app/not-found";
import { technicalErrorText } from "../src/lib/error-details";

const failure = {
  name: "PrismaClientKnownRequestError",
  message: "net pay 50000.00 for asha@example.com",
  stack: "Error: net pay\n    at payroll.ts:10",
  digest: "1234",
};

test("development errors include the message and stack", () => {
  const text = technicalErrorText("development", failure);
  assert.equal(text?.includes("PrismaClientKnownRequestError"), true);
  assert.equal(text?.includes("net pay 50000.00"), true);
  assert.equal(text?.includes("Digest: 1234"), true);
  assert.equal(text?.includes("payroll.ts:10"), true);
});

test("production and test errors stay user-facing", () => {
  assert.equal(technicalErrorText("production", failure), null);
  assert.equal(technicalErrorText("test", failure), null);
  assert.equal(technicalErrorText(undefined, failure), null);
});

test("the error page shows the stack in development and hides it otherwise", () => {
  const env = process.env as { NODE_ENV?: string };
  const previous = env.NODE_ENV;
  const error = Object.assign(new Error("secret net pay"), { digest: "abc", stack: "at entry.ts:4" });
  try {
    env.NODE_ENV = "production";
    const production = renderToStaticMarkup(createElement(AppError, { error, reset: () => undefined }));
    assert.equal(production.includes("secret net pay"), false);
    assert.equal(production.includes("entry.ts"), false);
    assert.equal(production.includes("The page could not be loaded"), true);

    env.NODE_ENV = "development";
    const development = renderToStaticMarkup(createElement(AppError, { error, reset: () => undefined }));
    assert.equal(development.includes("This detail is shown only in development."), true);
    assert.equal(development.includes("secret net pay"), true);
    assert.equal(development.includes("at entry.ts:4"), true);
  } finally {
    if (previous === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previous;
  }
});

test("the 404 page names the missing page without a technical detail", () => {
  const html = renderToStaticMarkup(createElement(NotFoundScreen));
  assert.equal(html.includes("Page not found"), true);
  assert.equal(html.includes("That page is not available."), true);
  assert.equal(html.includes("Go to home"), true);
});
