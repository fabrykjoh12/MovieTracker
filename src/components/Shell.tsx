import { useEffect, useState } from "react";
import {
  Compass,
  Home,
  Library,
  Menu,
  Moon,
  Search,
  Sun,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useStore } from "../store";

const navigation = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/library", label: "Library", icon: Library },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export function Shell() {
  const { status, user } = useAuth();
  const { librarySync } = useStore();
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    localStorage.getItem("movietracker:theme") === "light" ? "light" : "dark",
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("movietracker:theme", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="MovieTracker home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            MOVIE<span>TRACKER</span>
          </span>
        </NavLink>
        <div className="topbar-actions">
          <button
            className="icon-button search-button"
            type="button"
            aria-label="Search MovieTracker"
          >
            <Search size={19} />
            <span>Search</span>
            <kbd>/</kbd>
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="icon-button menu-button"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label="Open menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <NavLink
            to="/account"
            className="account-link"
            aria-label="Account and data"
          >
            <span className={`mode-badge ${status}`}>
              {status === "demo"
                ? "Demo"
                : status === "authenticated"
                  ? librarySync.status === "synced"
                    ? "Synced"
                    : librarySync.status === "saving"
                      ? "Saving"
                      : librarySync.status === "needs-import"
                        ? "Set up"
                        : librarySync.status === "error"
                          ? "Offline"
                          : "Connecting"
                  : "Account"}
            </span>
            <span className="avatar">
              {user?.email?.slice(0, 2).toUpperCase() ?? "AK"}
            </span>
          </NavLink>
        </div>
      </header>

      <aside
        className={`sidebar ${menuOpen ? "is-open" : ""}`}
        id="mobile-menu"
      >
        <nav aria-label="Primary navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              to={to}
              key={to}
              end={to === "/"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>YOUR WEEK</p>
          <div className="week-stat">
            <strong>4h 32m</strong>
            <span>watched</span>
          </div>
          <div
            className="mini-bars"
            aria-label="Four hours and thirty-two minutes watched this week"
          >
            {[35, 80, 20, 56, 92, 44, 10].map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            to={to}
            key={to}
            end={to === "/"}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
