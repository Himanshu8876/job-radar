import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";

const navItems = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Jobs", path: "/jobs" },
  { name: "Matches", path: "/matches" },
  { name: "Applications", path: "/applications" },
  { name: "Profile", path: "/profile" },
];

function Layout() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function renderNavigation(onNavigate?: () => void) {
    return navItems.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onNavigate}
        className={({ isActive }) =>
          `block rounded-lg px-4 py-3 text-sm font-medium ${
            isActive
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`
        }
      >
        {item.name}
      </NavLink>
    ));
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-64 border-r bg-white p-6 md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:h-screen md:flex-col md:overflow-y-auto md:shadow-sm">
        <Link
          to="/dashboard"
          className="mb-8 block text-2xl font-bold text-gray-900"
        >
          Job Radar
        </Link>

        <nav className="space-y-2">
          {renderNavigation()}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-8 flex w-full items-center gap-3 rounded-lg border border-red-100 bg-red-50/60 px-4 py-3 text-left text-sm font-semibold text-red-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 active:bg-red-100"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-gray-950/40 md:hidden"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMobileMenuOpen(false);
            }
          }}
        >
          <aside className="flex h-full w-[min(18rem,85vw)] flex-col bg-white p-5 shadow-xl">
            <div className="mb-8 flex items-center justify-between">
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xl font-bold text-gray-900"
              >
                Job Radar
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label="Close navigation menu"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-2">
              {renderNavigation(() => setMobileMenuOpen(false))}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-8 flex min-h-11 w-full items-center gap-3 rounded-lg border border-red-100 bg-red-50/60 px-4 py-3 text-left text-sm font-semibold text-red-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 md:ml-64 md:p-8">
        <div className="mb-5 flex items-center justify-between md:hidden">
          <h1 className="text-xl font-bold text-gray-900">Job Radar</h1>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;