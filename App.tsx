import { useEffect, useState } from "react";
import CampaignManager from "./pages/CampaignManager";
import ManagerDashboard from "./pages/ManagerDashboard";
import OpsConsole from "./pages/OpsConsole";
import RiskPredictor from "./pages/RiskPredictor";

const PAGES = [
  {
    path: "#/manager",
    label: "Manager Dashboard",
    Component: ManagerDashboard,
  },
  { path: "#/ops", label: "Ops Console", Component: OpsConsole },
  { path: "#/campaigns", label: "Campaign", Component: CampaignManager },
  { path: "#/predict", label: "Risk Predictor", Component: RiskPredictor },
];
const currentPage = () =>
  PAGES.find((p) => p.path === window.location.hash) ?? PAGES[0];
export default function App() {
  const [page, setPage] = useState(currentPage);
  useEffect(() => {
    const change = () => {
      setPage(currentPage());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title = `${page.label} · Data Warehouse`;
  }, [page]);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to main content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <nav className="top-navigation" aria-label="Main navigation">
            {PAGES.map((p) => (
              <a
                key={p.path}
                href={p.path}
                className={p === page ? "nav-link active" : "nav-link"}
                aria-current={p === page ? "page" : undefined}
              >
                {p.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="main" id="main-content" tabIndex={-1}>
        <page.Component />
        <footer className="site-footer">
          <span>Data Warehouse & Decision Support</span>
          <span>
            Olist dataset <span className="footer-divider">·</span> Currency:
            BRL (R$)
          </span>
        </footer>
      </main>
    </div>
  );
}
