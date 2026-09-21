import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import Login from "./pages/Login";

import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import JobDetails from "./pages/JobDetails";
import Matches from "./pages/Matches";
import Applications from "./pages/Applications";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";
import Signup from "./pages/Signup";

function App() {
  return (
    <Routes>
      {/* Public pages - NO SIDEBAR */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Authenticated application - SIDEBAR */}
      <Route element={<ProtectedRoute />}>
  <Route element={<Layout />}>
    <Route
      path="/"
      element={<Navigate to="/dashboard" replace />}
    />

    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/jobs" element={<Jobs />} />
    <Route path="/jobs/:id" element={<JobDetails />} />
    <Route path="/matches" element={<Matches />} />
    <Route path="/applications" element={<Applications />} />
    <Route path="/profile" element={<Profile />} />
  </Route>
</Route>
    </Routes>
  );
}

export default App;