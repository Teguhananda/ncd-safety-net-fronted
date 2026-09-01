import Sidebar from "./Sidebar";

export default function Layout({ title, meta, children }) {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <h1>{title}</h1>
            <div className="meta">{meta}</div>
          </div>
        </div>
        <div className="net-divider"></div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
