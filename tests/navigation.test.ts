import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { NavigationLink } from "../src/app/navigation-link";

const routes = [
  "/",
  "/goals",
  "/log",
  "/leaderboard",
  "/teams",
  "/community",
  "/profile",
  "/admin",
];

function renderMenu(pathname: string) {
  return renderToStaticMarkup(
    createElement(
      PathnameContext.Provider,
      { value: pathname },
      routes.map((href) =>
        createElement(NavigationLink, { key: href, href, children: href }),
      ),
    ),
  );
}

for (const route of routes) {
  test(`only ${route} is current at its pathname`, () => {
    const html = renderMenu(route);
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.ok(
      html
        .match(/<a[^>]*aria-current="page"[^>]*>/g)?.[0]
        .includes(`href="${route}"`),
    );
    if (route !== "/log")
      assert.ok(
        !html
          .match(/<a[^>]*aria-current="page"[^>]*>/g)?.[0]
          .includes('href="/log"'),
      );
  });
}

test("nested routes select their section without selecting Home", () => {
  const html = renderMenu("/goals/example");
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.ok(
    html
      .match(/<a[^>]*aria-current="page"[^>]*>/g)?.[0]
      .includes('href="/goals"'),
  );
});

test("similar pathname prefixes do not select an unrelated section", () => {
  assert.ok(!renderMenu("/goals-archive").includes("aria-current"));
});
