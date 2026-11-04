import { useEffect, useState } from "react";
import CampaignManager from "./pages/CampaignManager";
import ManagerDashboard from "./pages/ManagerDashboard";
import OpsConsole from "./pages/OpsConsole";
import RiskPredictor from "./pages/RiskPredictor";

// Một app, một cổng: mỗi màn hình là một route hash (#/manager, #/ops, #/campaigns, #/predict) để gửi link trực tiếp được
const PAGES = [
  { path: "#/manager", label: "Manager Dashboard", Component: ManagerDashboard },
  { path: "#/ops", label: "Ops Console", Component: OpsConsole },
  { path: "#/campaigns", label: "Campaign", Component: CampaignManager },
  { path: "#/predict", label: "Dự đoán rủi ro", Component: RiskPredictor },
];

function currentPage() {
  return PAGES.find((p) => p.path === window.location.hash) ?? PAGES[0];
}

export default function App() {
  const [page, setPage] = useState(currentPage);

  useEffect(() => {
    const onHashChange = () => setPage(currentPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <nav style={{ display: "flex", gap: 4, padding: "12px 24px", borderBottom: "1px solid #ddd" }}>
        {PAGES.map((p) => (
          <a
            key={p.path}
            href={p.path}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              textDecoration: "none",
              color: p === page ? "#fff" : "#333",
              background: p === page ? "#2563eb" : "transparent",
            }}
          >
            {p.label}
          </a>
        ))}
      </nav>
      <page.Component />
    </div>
  );
}
