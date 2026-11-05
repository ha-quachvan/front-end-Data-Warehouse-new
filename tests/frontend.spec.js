import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

const categories = ["bed_bath_table", "cool_stuff"];
const order = {
  order_id: "38541d08d4eb7d571b5b80cb6ca9be03",
  risk_score: 0.84,
  risk_level: "High",
  actual_label: true,
  order_status: "shipped",
  purchase_ts: "2018-07-02",
  carrier_ts: "2018-07-06",
  delivered_ts: "2018-07-27",
  estimated_date: "2018-07-25",
  seller_state: "SP",
  customer_state: "RJ",
  category: "cool_stuff",
  distance_km: 384.6,
  estimated_days: 23,
  carrier_days: 4,
  delay_days: 2,
  total_price: 137,
  review_score: 1,
};
const revenue = Array.from({ length: 12 }, (_, i) => ({
  year: 2018,
  month: i + 1,
  category: categories[i % 2],
  region: "Sudeste",
  state: i % 2 ? "RJ" : "SP",
  total_revenue: 300000 + i * 45000,
  total_quantity: 400,
  total_orders: 300,
}));

async function mockApi(page) {
  let campaigns = [
    {
      campaign_code: "CARE_CALL",
      campaign_name: "Care call",
      description: "Care for customers at risk of low ratings.",
      total_targets: 0,
    },
  ];
  let customers = [];
  await page.route("http://localhost:8000/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method();
    const body = req.postDataJSON();
    let data;
    if (path === "/dashboard/kpi-summary")
      data = {
        total_revenue: 13494401,
        total_orders: 98199,
        aov: 137,
        avg_review_score: 4.04,
        late_delivery_rate: 0.066,
      };
    else if (path === "/dashboard/revenue-trend")
      data = revenue.filter((r) =>
        ["year", "category", "region"].every(
          (k) =>
            !url.searchParams.get(k) ||
            String(r[k]) === url.searchParams.get(k),
        ),
      );
    else if (path === "/dashboard/top-products")
      data = [
        {
          product_id: "46fce52cef5caa7cc225a5531c946c8b",
          category: "cool_stuff",
          total_revenue: 2,
          total_quantity: 1,
          total_orders: 1,
          avg_review_score: 5,
        },
      ];
    else if (path === "/dashboard/delivery-trend")
      data = revenue.map((r, i) => ({
        year: r.year,
        month: r.month,
        delivered_orders: 1000,
        late_rate: 0.04 + i * 0.005,
        avg_delivery_days: 15,
        avg_review_score: 4,
        low_review_rate: 0.1 + i * 0.003,
      }));
    else if (path === "/dashboard/delivery-routes")
      data = [
        {
          seller_state: "SP",
          customer_state: "RJ",
          delivered_orders: 8159,
          late_rate: 0.141,
          avg_delivery_days: 16.3,
          avg_estimated_days: 27,
          low_review_rate: 0.201,
        },
      ];
    else if (path === "/dashboard/review-by-delay")
      data = [
        "Sớm ≥ 10 ngày",
        "Sớm 1–9 ngày",
        "Đúng ngày hẹn",
        "Trễ 1–3 ngày",
        "Trễ 4–7 ngày",
        "Trễ > 7 ngày",
      ].map((bucket, i) => ({
        bucket,
        orders: 100,
        avg_review_score: 4,
        low_review_rate: 0.09 + i * i * 0.025,
      }));
    else if (path === "/risk/predict/options")
      data = {
        seller_state: ["SP", "RJ"],
        customer_state: ["SP", "RJ"],
        category: categories,
        payment_type: ["credit_card"],
        shipping_limit: { days: 6, source: "quy định sàn" },
      };
    else if (path === "/risk/predict/distance")
      data = {
        seller_state: "SP",
        customer_state: "RJ",
        distance_km: 384.6,
        source: "trung vị tuyến",
        orders: 6845,
      };
    else if (path.endsWith("/predict"))
      data = {
        model: path.split("/")[2],
        risk_score: 0.414,
        risk_level: "Medium",
        threshold: 0.5,
        inputs_used: [
          {
            feature: "distance_km",
            value: body.distance_km ?? 384.6,
            source: "nhập",
          },
          { feature: "total_price", value: 137, source: "trung vị tuyến" },
        ],
        derived: { estimated_days: 23 },
        route_history: {
          orders: 6845,
          late_rate: 0.164,
          low_review_rate: 0.219,
        },
      };
    else if (path.endsWith("/what-if"))
      data = {
        order_id: order.order_id,
        threshold: 0.5,
        before: { risk_score: 0.84, risk_level: "High" },
        after: { risk_score: 0.12, risk_level: "Low" },
      };
    else if (path.endsWith("/summary"))
      data = ["open", "holdout"].flatMap((scope) =>
        ["High", "Medium", "Low"].map((risk_level, i) => ({
          scope,
          risk_level,
          orders: i === 0 ? 1 : 0,
          avg_score: 0.84,
          actual_rate: scope === "open" ? null : 0.419,
        })),
      );
    else if (path.endsWith("/orders"))
      data = url.searchParams.get("level") === "Low" ? [] : [order];
    else if (path === "/risk/metrics") data = [];
    else if (path.endsWith("/importance"))
      data = [{ feature: "distance_km", importance: 0.12 }];
    else if (path === "/campaigns" && method === "POST") {
      const c = { campaign_code: "NEW_CARE", ...body, total_targets: 0 };
      campaigns.push(c);
      data = c;
    } else if (path === "/campaigns") data = campaigns;
    else if (path.endsWith("/targets")) {
      const c = campaigns.find((c) => c.campaign_code === path.split("/")[2]);
      if (method === "POST") {
        customers = [
          {
            customer_id: "customer-001",
            city: "rio de janeiro",
            state: "RJ",
            order_id: order.order_id,
            risk_score: 0.84,
            assigned_at: "2026-11-04T10:36:00",
          },
        ];
        c.total_targets = 1;
        data = { inserted: 1 };
      } else if (method === "DELETE") {
        customers = [];
        c.total_targets = 0;
        data = { deleted: 1 };
      } else
        data = {
          campaign_code: c.campaign_code,
          total: customers.length,
          avg_risk: customers.length ? 0.84 : null,
          customers,
        };
    } else if (path.startsWith("/campaigns/")) {
      const code = path.split("/")[2];
      if (method === "DELETE") {
        campaigns = campaigns.filter((c) => c.campaign_code !== code);
        data = { deleted_targets: 0 };
      } else {
        const c = campaigns.find((c) => c.campaign_code === code);
        Object.assign(c, body);
        data = c;
      }
    } else {
      await route.fulfill({
        status: 404,
        json: { detail: "Unknown mock endpoint" },
      });
      return;
    }
    await route.fulfill({ json: data });
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("manager preserves analysis, removes top revenue products and filters using original category codes", async ({
  page,
}) => {
  const calls = [];
  page.on("request", (r) => calls.push(r.url()));
  await page.goto("/#/manager");
  await expect(page.locator(".kpi-card").first()).toContainText("13,494,401");
  await expect(
    page.getByRole("heading", { name: "Top 10 products by revenue" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "10 lowest-revenue products",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("São Paulo (SP) → Rio de Janeiro (RJ)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Cool Stuff", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Category", { exact: true }).selectOption("cool_stuff");
  await expect
    .poll(() => calls.some((u) => u.includes("category=cool_stuff")))
    .toBeTruthy();
  expect(
    calls
      .filter((u) => u.includes("/top-products"))
      .every((u) => u.includes("ascending=true")),
  ).toBeTruthy();
  await page.screenshot({
    path: "/tmp/olist-manager-desktop.png",
    fullPage: true,
  });
});

test("operations handles what-if, assignment, filters and CSV/XLSX downloads", async ({
  page,
}) => {
  await page.goto("/#/ops");
  await page.getByRole("button", { name: "Simulate action" }).click();
  await page
    .getByRole("button", { name: "Simulate risk after action" })
    .click();
  await expect(page.getByText("12.0%", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Assign customers", exact: true })
    .click();
  await expect(
    page.getByText("Added 1 customer", { exact: false }),
  ).toBeVisible();
  const firstSection = page.locator("section").first();
  for (const format of ["csv", "xlsx"]) {
    await firstSection.getByLabel("File format").selectOption(format);
    const wait = page.waitForEvent("download");
    await firstSection.getByRole("button", { name: "Download" }).click();
    const download = await wait;
    expect(download.suggestedFilename()).toMatch(
      new RegExp("\\." + format + "$"),
    );
    expect(await download.failure()).toBeNull();
    const path = await download.path();
    if (format === "csv") {
      const csv = await readFile(path, "utf8");
      expect(csv).toContain(
        "Order ID,Risk (%),Risk level,Seller state,Customer state",
      );
      expect(csv).toContain(order.order_id);
    } else {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(path);
      expect(workbook.worksheets[0].name).toBe("List");
      expect(workbook.worksheets[0].getRow(1).values.slice(1, 6)).toEqual([
        "Order ID",
        "Risk (%)",
        "Risk level",
        "Seller state",
        "Customer state",
      ]);
      expect(workbook.worksheets[0].getCell("A2").value).toBe(order.order_id);
    }
  }
  await firstSection.locator("select").first().selectOption("Low");
  await expect(
    firstSection.getByText("No orders match this selection."),
  ).toBeVisible();
});

test("campaign create edit detail delete and target cleanup", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/#/ops");
  await page
    .getByRole("button", { name: "Assign customers", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Campaign", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Details" }).click();
  await expect(
    page.getByRole("cell", { name: "Rio de Janeiro (RJ)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove all customers" }).click();
  await expect(
    page.getByText("No customers assigned yet.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Campaign name").fill("Priority support");
  await page.getByLabel("Campaign description").fill("Test description");
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "Priority support", exact: true }),
  });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Campaign name").last().fill("Updated priority");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const edited = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "Updated priority", exact: true }),
  });
  await edited.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(edited).toHaveCount(0);
});

test("prediction sends raw codes, blocks invalid dates and clears stale results", async ({
  page,
}) => {
  await page.goto("/#/predict");
  await expect(page.getByLabel("Seller state")).toContainText("São Paulo (SP)");
  await page.getByLabel("Category", { exact: true }).selectOption("cool_stuff");
  const buttons = page.getByRole("button", { name: "Predict", exact: true });
  const request = page.waitForRequest((r) =>
    r.url().endsWith("/risk/late_delivery/predict"),
  );
  await buttons.first().click();
  expect((await request).postDataJSON().category).toBe("cool_stuff");
  await expect(page.getByText("41.4%", { exact: true })).toBeVisible();
  await page
    .getByLabel("Estimated delivery date", { exact: true })
    .fill("2018-07-01");
  await expect(buttons.first()).toBeDisabled();
  await expect(page.getByText("41.4%", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("Check your inputs");
  await page
    .getByLabel("Estimated delivery date", { exact: true })
    .fill("2018-07-25");
  await buttons.last().click();
  await expect(page.getByText("41.4%", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "/tmp/olist-predict-desktop.png",
    fullPage: true,
  });
});

test("all routes fit mobile viewport without horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["manager", "ops", "campaigns", "predict"]) {
    await page.goto("/#/" + path);
    await expect(page.locator("h1")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBeTruthy();
    await page.screenshot({
      path: "/tmp/olist-" + path + "-mobile.png",
      fullPage: true,
    });
  }
});

test("unavailable backend reports errors without uncaught exceptions", async ({
  page,
}) => {
  await page.unrouteAll();
  await page.route("http://localhost:8000/**", (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of ["manager", "ops", "campaigns", "predict"]) {
    await page.goto("/#/" + path);
    await expect(
      page
        .getByText(/Unable to connect to the data server|Unable to load/)
        .first(),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("English interface localizes backend labels without rewriting API values", async ({
  page,
}) => {
  const vietnameseUI = /[đĐăĂơƠưƯ\u1ea0-\u1ef9]/u;
  await page.goto("/#/manager");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel("Main navigation")).toContainText(
    "Risk Predictor",
  );
  await expect(page.getByText("On time", { exact: true })).toBeVisible();
  const regionRequest = page.waitForRequest((r) =>
    r.url().includes("region=Sudeste"),
  );
  await page
    .getByLabel("Region", { exact: true })
    .selectOption({ label: "Southeast" });
  expect(new URL((await regionRequest).url()).searchParams.get("region")).toBe(
    "Sudeste",
  );
  await expect(page.locator("body")).not.toContainText(vietnameseUI);
  for (const route of ["ops", "campaigns", "predict"]) {
    await page.goto("/#/" + route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(vietnameseUI);
  }
  await expect(page.getByText("marketplace policy")).toBeVisible();
  await expect(
    page.getByText("Median from 6,845 historical orders on this route"),
  ).toBeVisible();
  const request = page.waitForRequest((r) =>
    r.url().endsWith("/risk/late_delivery/predict"),
  );
  await page
    .getByRole("button", { name: "Predict", exact: true })
    .first()
    .click();
  const payload = (await request).postDataJSON();
  expect(payload).toMatchObject({
    seller_state: "SP",
    customer_state: "RJ",
    category: "bed_bath_table",
    shipping_limit_days: null,
  });
  await page.getByText("Model inputs (2 features)", { exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "User input", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Route median", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(vietnameseUI);
});
