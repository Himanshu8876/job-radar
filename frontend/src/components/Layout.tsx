import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

const navItems = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Jobs", path: "/jobs" },
  { name: "Matches", path: "/matches" },
  { name: "Applications", path: "/applications" },
  { name: "Profile", path: "/profile" },
];

function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 border-r bg-white p-6 md:fixed md:inset-y-0 md:left-0 md:z-40 md:h-screen md:overflow-y-auto md:shadow-sm">
        <h1 className="mb-8 text-2xl font-bold text-gray-900">
          Job Radar
        </h1>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
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
          ))}
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

      <main className="min-w-0 flex-1 p-8 md:ml-64">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;