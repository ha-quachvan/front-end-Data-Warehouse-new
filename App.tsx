import { useEffect, useState } from "react";
import CampaignManager from "./pages/CampaignManager";
import ManagerDashboard from "./pages/ManagerDashboard";
import OpsConsole from "./pages/OpsConsole";
import RiskPredictor from "./pages/RiskPredictor";

const PAGES = [
  {
    path: "#/manager",
    label: "Manager Dashboard",
    caption: "Tổng quan kinh doanh",
    icon: "▦",
    Component: ManagerDashboard,
  },
  {
    path: "#/ops",
    label: "Ops Console",
    caption: "Vận hành & rủi ro",
    icon: "⇄",
    Component: OpsConsole,
  },
  {
    path: "#/campaigns",
    label: "Campaign",
    caption: "Chăm sóc khách hàng",
    icon: "◎",
    Component: CampaignManager,
  },
  {
    path: "#/predict",
    label: "Dự đoán rủi ro",
    caption: "Hỗ trợ quyết định",
    icon: "◈",
    Component: RiskPredictor,
  },
];
const currentPage = () =>
  PAGES.find((p) => p.path === window.location.hash) ?? PAGES[0];

export default function App() {
  const [page, setPage] = useState(currentPage);
  useEffect(() => {
    const change = () => setPage(currentPage());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title = `${page.label} · Olist Insight`;
  }, [page]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <header className="app-header">
        <a href="#/manager" className="brand">
          <span className="brand-mark" aria-hidden="true">
            oi
          </span>
          <span>
            olist<span className="brand-light"> insight</span>
            <small>DATA WAREHOUSE & DECISION SUPPORT</small>
          </span>
        </a>
        <span className="workspace-label">
          Không gian phân tích <span>Olist · Brazil</span>
        </span>
      </header>
      <nav className="main-nav" aria-label="Điều hướng chính">
        {PAGES.map((p) => (
          <a
            key={p.path}
            href={p.path}
            aria-current={p === page ? "page" : undefined}
            className={p === page ? "active" : ""}
          >
            <span className="nav-icon" aria-hidden="true">
              {p.icon}
            </span>
            <span>
              {p.label}
              <small>{p.caption}</small>
            </span>
          </a>
        ))}
      </nav>
      <main id="main-content" className="page-content" tabIndex={-1}>
        <div className="breadcrumb">
          Không gian phân tích <span>/</span> <b>{page.label}</b>
        </div>
        <page.Component />
      </main>
      <footer className="app-footer">
        <span>Olist Insight</span> Kho dữ liệu & Hệ hỗ trợ quyết định{" "}
        <span>Đơn vị tiền tệ: BRL (R$)</span>
      </footer>
    </div>
  );
}
