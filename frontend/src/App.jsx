
import { isValidElement, useCallback, useEffect, useState,useRef } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  DoorOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem("access_token");

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (response.status === 401) {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");
    window.location.reload();
    throw new Error("Your session expired. Please sign in again.");
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data
        ? data.detail || data.message || `Request failed: ${response.status}`
        : `Request failed: ${response.status}`
    );
  }

  return data;
}

function getList(data, keys = []) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key];
  }

  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;

  return [];
}

function money(value) {
  const number = Number(value ?? 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function label(value) {
  if (value === null || value === undefined || value === "") return "—";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(name = "User") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function userName(user) {
  return user?.full_name || user?.name || user?.email || "SecureOps User";
}

function ErrorMessage({ message, onRetry }) {
  if (!message) return null;

  return (
    <div className="error-banner">
      <AlertCircle size={18} />
      <span>{message}</span>
      {onRetry && (
        <button className="error-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="section-heading">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ value }) {
  const status = String(value ?? "UNKNOWN")
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");

  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-badge-dot" />
      {label(value)}
    </span>
  );
}

function DataTable({ rows, columns, loading, emptyMessage = "No records found." }) {
  if (loading) {
    return (
      <div className="table-state">
        <RefreshCw size={20} className="spin-icon" />
        Loading records...
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <FileText size={24} />
        </div>
        <strong>No records found</strong>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? row.guard_id ?? row.payroll_id ?? index}>
              {columns.map((column) => {
                const value = column.render
                  ? column.render(row)
                  : row[column.key];

                return (
                  <td key={column.key}>
                    {column.status ? (
                      <StatusBadge value={value} />
                    ) : value === null || value === undefined || value === "" ? (
                      "—"
                    ) : isValidElement(value) ? (
                      value
                    ) : typeof value === "boolean" ? (
                      value ? "Yes" : "No"
                    ) : (
                      String(value)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder = "Search records..." }) {
  return (
    <div className="table-search">
      <Search size={17} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function filterRows(rows, search) {
  const query = search.toLowerCase();

  return rows.filter((row) =>
    Object.values(row || {})
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const body = new URLSearchParams();
      body.set("username", email.trim());
      body.set("password", password);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed.");
      }

      sessionStorage.setItem("access_token", data.access_token);

      const user = await apiRequest("/auth/me");
      sessionStorage.setItem("user", JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-brand-panel">
        <div className="brand-logo brand-logo-light">
          <span className="brand-icon"><ShieldCheck size={25} /></span>
          <span>SecureOps</span>
        </div>

        <div className="login-brand-content">
          <span className="eyebrow eyebrow-light">SECURITY OPERATIONS PLATFORM</span>
          <h1>Every guard.<br />Every site.<br /><span>Under control.</span></h1>
          <p>Manage your security workforce, deployments, attendance and payroll from one central platform.</p>
          <div className="login-feature-list">
            <div><CheckCircle2 size={18} /> Workforce management</div>
            <div><CheckCircle2 size={18} /> Site and deployment tracking</div>
            <div><CheckCircle2 size={18} /> Attendance and payroll visibility</div>
          </div>
        </div>

        <p className="login-footer-text">Secure operations. Clear visibility. Better control.</p>
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="mobile-brand">
            <span className="brand-icon"><ShieldCheck size={24} /></span>
            <strong>SecureOps</strong>
          </div>

          <div className="login-heading">
            <span className="eyebrow">WELCOME BACK</span>
            <h2>Sign in to your account</h2>
            <p>Enter your credentials to access your workspace.</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <div className="password-label-row">
              <label htmlFor="password">Password</label>
            </div>

            <div className="password-input-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && <div className="form-error"><AlertCircle size={17} />{error}</div>}

            <button className="primary-button login-submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="login-security-note">
            <Shield size={17} />
            Your access is protected by SecureOps authentication.
          </div>
        </div>
      </section>
    </main>
  );
}

const navGroups = [
  {
    heading: "OVERVIEW",
    items: [{ label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "WORKFORCE",
    items: [
      { label: "Guards", icon: Users },
      { label: "Clients", icon: Building2 },
      { label: "Sites & Posts", icon: MapPin },
      { label: "Deployments", icon: ShieldCheck },
      { label: "Replacement History", icon: Activity },
    ],
  },
  {
    heading: "OPERATIONS",
    items: [
      { label: "Attendance", icon: ClipboardCheck },
      { label: "Leave Requests", icon: CalendarDays },
      { label: "Payroll", icon: Wallet },
    ],
  },
];

function Sidebar({ activePage, setActivePage, user, onLogout, mobileOpen, setMobileOpen }) {
  return (
    <>
      {mobileOpen && (
        <button className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-icon"><ShieldCheck size={23} /></span>
          <div><strong>SecureOps</strong><span>WORKFORCE CONTROL</span></div>
          <button className="mobile-close-button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={19} />
          </button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-icon"><Building2 size={18} /></div>
          <div className="workspace-copy"><strong>Operations</strong><span>Management workspace</span></div>
        </div>

        <nav className="sidebar-navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.heading}>
              <p className="nav-heading">{group.heading}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.label;

                return (
                  <button
                    key={item.label}
                    className={`nav-item ${active ? "nav-item-active" : ""}`}
                    onClick={() => {
                      setActivePage(item.label);
                      setMobileOpen(false);
                    }}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {active && <span className="active-indicator" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="status-dot" />
            <div><strong>System connected</strong><span>SecureOps API</span></div>
          </div>

          <div className="sidebar-user">
            <div className="avatar">{initials(userName(user))}</div>
            <div className="sidebar-user-info">
              <strong>{userName(user)}</strong>
              <span>{label(user?.role || "User")}</span>
            </div>
            <button className="logout-button" onClick={onLogout} title="Sign out" aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ activePage, user, onRefresh, loading, setMobileOpen }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu size={21} />
        </button>
        <div>
          <div className="breadcrumb">
            <span>SecureOps</span><span className="breadcrumb-divider">/</span><strong>{activePage}</strong>
          </div>
          <p className="topbar-subtitle">Welcome back, {userName(user).split("@")[0]}.</p>
        </div>
      </div>

      <div className="topbar-actions">
        <div className="system-indicator"><span className="status-dot" />System online</div>
        <button className="icon-button" onClick={onRefresh} disabled={loading} title="Refresh" aria-label="Refresh">
          <RefreshCw size={18} className={loading ? "spin-icon" : ""} />
        </button>
        <button className="icon-button notification-button" title="Notifications" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <div className="topbar-avatar">{initials(userName(user))}</div>
      </div>
    </header>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, tone = "blue" }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-title">{title}</span>
        <span className={`stat-icon stat-icon-${tone}`}><Icon size={20} /></span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-subtitle">{subtitle}</div>
    </article>
  );
}


function DashboardHome({ dashboard, dashboardError, loading, clients,onOpenReplacement}) {
  const data = dashboard || {};

  const [leaveGuards, setLeaveGuards] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState("");
    
  const [replacementAlerts, setReplacementAlerts] = useState([]);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementError, setReplacementError] = useState("");
  const [selectedReplacementTarget, setSelectedReplacementTarget] =
  useState(null);
  
  const loadReplacementAlerts = useCallback(async () => {
    setReplacementLoading(true);
    setReplacementError("");

    try {
      const response = await apiRequest(
        "/dashboard/replacement-alerts"
      );

      setReplacementAlerts(response.alerts || []);
    } catch (err) {
      setReplacementError(
        err.message || "Could not load replacement alerts."
      );
    } finally {
      setReplacementLoading(false);
    }
  }, []);



  const loadLeaveGuards = useCallback(async () => {
    setLeaveLoading(true);
    setLeaveError("");

    try {
      const response = await apiRequest(
        "/dashboard/guards-on-leave-today"
      );

      setLeaveGuards(response.guards || []);
    } catch (err) {
      setLeaveError(
        err.message || "Could not load guards currently on leave."
      );
    } finally {
      setLeaveLoading(false);
    }
  }, []);

  
  useEffect(() => {
    loadLeaveGuards();
    loadReplacementAlerts();
  }, [loadLeaveGuards, loadReplacementAlerts]);

  const leaveColumns = [
    {
      key: "guard_name",
      label: "Guard",
      render: (row) => (
        <div>
          <strong>{row.guard_name}</strong>
          <div className="small-muted">
            {row.security_id || `Guard ID ${row.guard_id}`}
          </div>
        </div>
      ),
    },
    {
      key: "start_date",
      label: "Leave from",
    },
    {
      key: "end_date",
      label: "Leave until",
    },
    {
      key: "reason",
      label: "Reason",
    },
    {
      key: "assigned_posts",
      label: "Assigned post / shift",
      render: (row) =>
        row.assigned_posts?.length ? (
          <div className="leave-assignment-list">
            {row.assigned_posts.map((assignment, index) => (
              <div key={`${assignment.post_name}-${assignment.shift_type}-${index}`}>
                <strong>{assignment.post_name}</strong>
                <span>{label(assignment.shift_type)}</span>
              </div>
            ))}
          </div>
        ) : (
          "No active deployment"
        ),
    },
  ];
  
  const replacementColumns = [
    {
      key: "deployment_id",
      label: "Deployment ID",
      render: (row) => `#${row.deployment_id}`,
    },
    {
      key: "guard_name",
      label: "Assigned Guard",
      render: (row) => (
        <div>
          <strong>{row.guard_name}</strong>
          <div className="small-muted">
            {row.security_id || `Guard ID ${row.guard_id}`}
          </div>
        </div>
      ),
    },
    {
      key: "post_name",
      label: "Security Post",
    },
    {
      key: "shift_type",
      label: "Shift",
      render: (row) => label(row.shift_type),
    },
    {
      key: "leave_periods",
      label: "Approved Leave",
      render: (row) => (
        <div className="leave-assignment-list">
          {row.leave_periods.map((period) => (
            <div key={period.leave_id}>
              <strong>
                {period.start_date} to {period.end_date}
              </strong>
              <span>{period.reason || "No reason provided"}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
    key: "actions",
    label: "Action",
    render: (row) => (
      <button
        type="button"
        className="primary-button"
        onClick={() => onOpenReplacement?.(row)}
      >
        Replace Guard
      </button>
    ),
  },
  ];

  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">OPERATIONS OVERVIEW</span>
          <h1>Dashboard</h1>
          <p>Monitor your security workforce and daily operations.</p>
        </div>

        <div className="date-chip">
          <CalendarDays size={17} />
          {new Date().toLocaleDateString("en-IN")}
        </div>
      </div>

      <ErrorMessage message={dashboardError} />

      <div className="stat-grid dashboard-stat-grid">
        <StatCard
          title="Total Guards"
          value={loading ? "—" : data.total_guards ?? 0}
          subtitle={`${data.active_guards ?? 0} active guards`}
          icon={Users}
          tone="blue"
        />

        <StatCard
          title="Active Deployments"
          value={loading ? "—" : data.active_deployments ?? 0}
          subtitle="Currently assigned"
          icon={ShieldCheck}
          tone="green"
        />

        <StatCard
          title="Active Posts"
          value={loading ? "—" : data.active_posts ?? 0}
          subtitle="Security posts"
          icon={MapPin}
          tone="purple"
        />

        <StatCard
          title="Guards on Leave Today"
          value={loading ? "—" : data.guards_on_leave_today ?? 0}
          subtitle="Approved leave requests"
          icon={CalendarDays}
          tone="orange"
        />

        <StatCard
          title="Total Clients"
          value={clients.length}
          subtitle="Loaded client records"
          icon={Building2}
          tone="blue"
        />
      </div>

      <div className="dashboard-main-grid">
        <section className="panel">
          <SectionHeading
            title="Staffing overview"
            subtitle="Guard requirements versus current deployments"
          />

          <div className="staffing-highlight">
            <div>
              <span className="muted-label">Vacant positions</span>
              <strong className="vacancy-number">
                {data.vacant_positions ?? 0}
              </strong>
              <span className="small-muted">Positions to fill</span>
            </div>
          </div>

          {[
            ["Required guard positions", data.required_guard_positions],
            ["Deployed guard positions", data.deployed_guard_positions],
          ].map(([name, value], index) => (
            <div className="staffing-row" key={name}>
              <div className="staffing-label">
                <span>{name}</span>
                <strong>{value ?? 0}</strong>
              </div>

              <div className="progress-track">
                <div
                  className={`progress-fill ${
                    index ? "progress-deployed" : "progress-required"
                  }`}
                  style={{
                    width: `${
                      index
                        ? Number(data.required_guard_positions) > 0
                          ? Math.min(
                              100,
                              (Number(value || 0) /
                                Number(data.required_guard_positions)) *
                                100
                            )
                          : 0
                        : 100
                    }%`,
                  }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="panel">
          <SectionHeading
            title="Today's attendance"
            subtitle="Records for the current day"
          />

          <div className="attendance-visual">
            <div className="attendance-ring">
              <div className="attendance-ring-inner">
                <ClipboardCheck size={26} />
                <strong>{data.present_today ?? 0}</strong>
                <span>Present today</span>
              </div>
            </div>
          </div>

          <p className="attendance-note">
            This figure is supplied by the backend attendance summary.
          </p>
        </section>
      </div>



    <section className="panel table-panel replacement-alert-panel">
      <div className="section-heading">
        <div>
          <h3>Replacement Alerts</h3>
          <p>Active deployments affected by approved guard leave today.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadReplacementAlerts}
          disabled={replacementLoading}
        >
          <RefreshCw
            size={16}
            className={replacementLoading ? "spin-icon" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="replacement-alert-summary">
        <span className="replacement-alert-count">
          {replacementLoading ? "—" : replacementAlerts.length}
        </span>
        <span>deployments requiring replacement</span>
      </div>

      <ErrorMessage
        message={replacementError}
        onRetry={loadReplacementAlerts}
      />

      <DataTable
        rows={replacementAlerts}
        columns={replacementColumns}
        loading={replacementLoading}
        emptyMessage="No active deployments currently require replacement."
      />
    </section>

      {/* Guards currently on approved leave */}
      <section className="panel table-panel dashboard-leave-panel">
        <div className="section-heading">
          <div>
            <h3>Guards Currently on Leave</h3>
            <p>
              Active guards with approved leave covering today.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={loadLeaveGuards}
            disabled={leaveLoading}
          >
            <RefreshCw
              size={16}
              className={leaveLoading ? "spin-icon" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="dashboard-leave-summary">
          <span className="dashboard-leave-count">
            {leaveLoading ? "—" : leaveGuards.length}
          </span>
          <span>
            {leaveGuards.length === 1
              ? "guard currently on approved leave"
              : "guards currently on approved leave"}
          </span>
        </div>

        <ErrorMessage
          message={leaveError}
          onRetry={loadLeaveGuards}
        />

        <DataTable
          rows={leaveGuards}
          columns={leaveColumns}
          loading={leaveLoading}
          emptyMessage="No active guards are on approved leave today."
        />
      </section>

      <section className="panel payroll-panel">
        <SectionHeading
          title="Monthly payroll"
          subtitle="Payroll totals reported by the backend"
        />

        <div className="payroll-grid">
          <div className="payroll-item">
            <span className="payroll-icon payroll-icon-blue">
              <Wallet size={20} />
            </span>
            <div>
              <span className="muted-label">Total payroll</span>
              <strong>{money(data.monthly_payroll_total)}</strong>
            </div>
          </div>

          <div className="payroll-item">
            <span className="payroll-icon payroll-icon-green">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <span className="muted-label">Paid</span>
              <strong>{money(data.monthly_payroll_paid)}</strong>
            </div>
          </div>

          <div className="payroll-item">
            <span className="payroll-icon payroll-icon-orange">
              <CreditCard size={20} />
            </span>
            <div>
              <span className="muted-label">Pending</span>
              <strong>{money(data.monthly_payroll_pending)}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}




function RecordsPage({ title, subtitle, rows, loading, error, onRefresh, columns, children, emptyMessage }) {
  const [search, setSearch] = useState("");
  const filtered = filterRows(rows, search);

  return (
    <div className="page-content">
      <div className="page-intro">
        <div><span className="eyebrow">OPERATIONS MANAGEMENT</span><h1>{title}</h1><p>{subtitle}</p></div>
        <button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} />Refresh</button>
      </div>

      {children}

      <section className="panel table-panel">
        <div className="section-heading" style={{ padding: "0 22px" }}>
          <div><h3>{title} records</h3><p>{rows.length} record(s) returned by the API</p></div>
        </div>

              
        
        <div className="table-toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search leave requests..."
          />

          <button
            type="button"
            className="secondary-button export-button"
            onClick={() =>
              exportRecordsToCSV(
                filtered,
                [
                  { key: "id", label: "Request ID" },
                  {
                    key: "guard_id",
                    label: "Guard ID",
                    render: (row) => row.guard_id,
                  },
                  { key: "start_date", label: "Start Date" },
                  { key: "end_date", label: "End Date" },
                  { key: "reason", label: "Reason" },
                  { key: "status", label: "Status" },
                ],
                "leave-requests-export.csv"
              )
            }
            disabled={!filtered || filtered.length === 0}
          >
            <FileText size={16} />
            Export CSV
          </button>
        </div>


        <ErrorMessage message={error} onRetry={onRefresh} />
        <DataTable rows={filtered} columns={columns} loading={loading} emptyMessage={emptyMessage} />
      </section>
    </div>
  );
}

function GuardsPage({ onCreate, ...props }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    gender: "",
    date_of_birth: "",
    phone: "",
    email: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    joining_date: new Date().toISOString().slice(0, 10),
    monthly_salary: "",
  });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitGuard(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFormMessage("");

    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      joining_date: form.joining_date,
      monthly_salary: Number(form.monthly_salary),
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
    };

    if (!payload.full_name || !payload.phone || !payload.joining_date || !Number.isFinite(payload.monthly_salary) || payload.monthly_salary <= 0) {
      setFormError("Enter the guard's name, phone, joining date, and a salary greater than zero.");
      setSaving(false);
      return;
    }
    if (payload.joining_date > new Date().toISOString().slice(0, 10)) {
      setFormError("Joining date cannot be in the future.");
      setSaving(false);
      return;
    }
    if (payload.date_of_birth && payload.date_of_birth >= payload.joining_date) {
      setFormError("Date of birth must be before joining date.");
      setSaving(false);
      return;
    }

    try {
      await apiRequest("/guards/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setFormMessage("Guard created successfully. The security ID was generated automatically.");
      setForm({
        full_name: "", gender: "", date_of_birth: "", phone: "", email: "", address: "",
        emergency_contact_name: "", emergency_contact_phone: "",
        joining_date: new Date().toISOString().slice(0, 10), monthly_salary: "",
      });
      await onCreate?.();
      setShowForm(false);
    } catch (err) {
      setFormError(err.message || "Could not create guard.");
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { name: "full_name", label: "Full name *", type: "text", required: true, placeholder: "Guard's full name" },
    { name: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"] },
    { name: "date_of_birth", label: "Date of birth", type: "date" },
    { name: "phone", label: "Phone number *", type: "tel", required: true, placeholder: "Phone number" },
    { name: "email", label: "Email address", type: "email", placeholder: "guard@example.com" },
    { name: "address", label: "Address", type: "text", placeholder: "Residential address" },
    { name: "emergency_contact_name", label: "Emergency contact name", type: "text", placeholder: "Contact person's name" },
    { name: "emergency_contact_phone", label: "Emergency contact phone", type: "tel", placeholder: "Emergency phone number" },
    { name: "joining_date", label: "Joining date *", type: "date", required: true },
    { name: "monthly_salary", label: "Monthly salary (₹) *", type: "number", required: true, min: "0.01", step: "0.01", placeholder: "e.g. 21000" },
  ];

  return (
    <RecordsPage
      {...props}
      title="Guards"
      subtitle="View registered security personnel."
      emptyMessage="Add your first guard using the Add Guard button."
      columns={[
        { key: "security_id", label: "Guard ID", render: (r) => r.security_id || r.id },
        { key: "full_name", label: "Name", render: (r) => r.full_name || r.name },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "monthly_salary", label: "Monthly salary", render: (r) => money(r.monthly_salary) },
        { key: "employment_status", label: "Employment", status: true },
        { key: "verification_status", label: "Verification", status: true },
      ]}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="primary-button" type="button" onClick={() => { setShowForm((value) => !value); setFormError(""); setFormMessage(""); }}>
          {showForm ? "Cancel" : "+ Add Guard"}
        </button>
      </div>

      {formMessage && <p className="success-message" role="status">{formMessage}</p>}

      {showForm && (
        <section className="panel" style={{ marginBottom: 20, padding: 22 }}>
          <SectionHeading title="Register a guard" subtitle="Fields marked * are required. The guard ID is generated automatically." />
          <form onSubmit={submitGuard}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 18 }}>
              {fields.map((field) => (
                <label key={field.name} className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>
                  {field.label}
                  {field.type === "select" ? (
                    <select className="form-field" name={field.name} value={form[field.name]} onChange={updateField}>
                      <option value="">Select gender</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input
                      className="form-field"
                      name={field.name}
                      type={field.type}
                      value={form[field.name]}
                      onChange={updateField}
                      required={field.required || false}
                      min={field.min}
                      step={field.step}
                      max={field.type === "date" && field.name === "joining_date" ? new Date().toISOString().slice(0, 10) : undefined}
                      placeholder={field.placeholder || ""}
                      autoComplete="off"
                    />
                  )}
                </label>
              ))}
            </div>
            <p className="small-muted" style={{ marginTop: 12 }}>New guards are created with ACTIVE employment and PENDING verification status.</p>
            <ErrorMessage message={formError} />
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? "Creating guard..." : "Create Guard"}</button>
              <button className="secondary-button" type="button" disabled={saving} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}
    </RecordsPage>
  );
}

function ClientsPage(props) {
  return (
    <RecordsPage
      {...props}
      title="Clients"
      subtitle="Companies receiving security services."
      columns={[
        { key: "client_code", label: "Client ID", render: (r) => r.client_code || r.id },
        { key: "company_name", label: "Company", render: (r) => r.company_name || r.name },
        { key: "industry", label: "Industry" },
        { key: "contact_person", label: "Contact person" },
        { key: "email", label: "Email" },
        { key: "city", label: "City" },
        { key: "is_active", label: "Active", render: (r) => r.is_active === undefined ? r.status : r.is_active ? "ACTIVE" : "INACTIVE", status: true },
      ]}
    />
  );
}

function SitesPostsPage({ branches, sites, posts, clients = [], loading, error, onRefresh, onBranchesCreated }) {
  const [activeTab, setActiveTab] = useState("Branches");
  const [showPostForm, setShowPostForm] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [postError, setPostError] = useState("");
  const [postMessage, setPostMessage] = useState("");
  const [postForm, setPostForm] = useState({ post_code: "", post_name: "", site_id: "", description: "", required_guards: "1", shift_type: "GENERAL", is_armed: false });

  function updatePostField(event) {
    const { name, value, type, checked } = event.target;
    setPostForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function submitPost(event) {
    event.preventDefault();
    setSavingPost(true);
    setPostError("");
    setPostMessage("");
    const payload = {
      post_code: postForm.post_code.trim(),
      post_name: postForm.post_name.trim(),
      site_id: Number(postForm.site_id),
      description: postForm.description.trim() || null,
      required_guards: Number(postForm.required_guards),
      shift_type: postForm.shift_type.trim(),
      is_armed: Boolean(postForm.is_armed),
    };
    if (!payload.post_code || !payload.post_name || !payload.site_id || !payload.shift_type || !Number.isInteger(payload.required_guards) || payload.required_guards < 1 || payload.required_guards > 500) {
      setPostError("Enter a post code, post name, site, valid shift type, and required guard count between 1 and 500.");
      setSavingPost(false);
      return;
    }
    try {
      await apiRequest("/security-posts", { method: "POST", body: JSON.stringify(payload) });
      setPostMessage("Security post created successfully.");
      setPostForm({ post_code: "", post_name: "", site_id: "", description: "", required_guards: "1", shift_type: "GENERAL", is_armed: false });
      setActiveTab("Security Posts");
      await onBranchesCreated?.();
      setShowPostForm(false);
    } catch (err) {
      setPostError(err.message || "Could not create security post.");
    } finally {
      setSavingPost(false);
    }
  }
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [siteError, setSiteError] = useState("");
  const [siteMessage, setSiteMessage] = useState("");
  const [siteForm, setSiteForm] = useState({
    site_code: "", site_name: "", branch_id: "", address: "", city: "", state: "", site_contact: "", contact_phone: "",
  });

  function updateSiteField(event) {
    const { name, value } = event.target;
    setSiteForm((current) => ({ ...current, [name]: value }));
  }

  async function submitSite(event) {
    event.preventDefault();
    setSavingSite(true);
    setSiteError("");
    setSiteMessage("");
    const payload = {
      site_code: siteForm.site_code.trim(),
      site_name: siteForm.site_name.trim(),
      branch_id: Number(siteForm.branch_id),
      address: siteForm.address.trim(),
      city: siteForm.city.trim(),
      state: siteForm.state.trim(),
      site_contact: siteForm.site_contact.trim() || null,
      contact_phone: siteForm.contact_phone.trim() || null,
    };
    if (!payload.site_code || !payload.site_name || !payload.branch_id || !payload.address || !payload.city || !payload.state) {
      setSiteError("Enter site code, site name, branch, address, city, and state.");
      setSavingSite(false);
      return;
    }
    try {
      await apiRequest("/sites", { method: "POST", body: JSON.stringify(payload) });
      setSiteMessage("Site created successfully.");
      setSiteForm({ site_code: "", site_name: "", branch_id: "", address: "", city: "", state: "", site_contact: "", contact_phone: "" });
      setActiveTab("Sites");
      await onBranchesCreated?.();
      setShowSiteForm(false);
    } catch (err) {
      setSiteError(err.message || "Could not create site.");
    } finally {
      setSavingSite(false);
    }
  }
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [branchError, setBranchError] = useState("");
  const [branchMessage, setBranchMessage] = useState("");
  const [branchForm, setBranchForm] = useState({
    branch_code: "", branch_name: "", client_id: "", address: "", city: "", state: "", pincode: "", contact_person: "", contact_phone: "",
  });

  function updateBranchField(event) {
    const { name, value } = event.target;
    setBranchForm((current) => ({ ...current, [name]: value }));
  }

  async function submitBranch(event) {
    event.preventDefault();
    setSavingBranch(true);
    setBranchError("");
    setBranchMessage("");
    const payload = {
      branch_code: branchForm.branch_code.trim(),
      branch_name: branchForm.branch_name.trim(),
      client_id: Number(branchForm.client_id),
      address: branchForm.address.trim() || null,
      city: branchForm.city.trim(),
      state: branchForm.state.trim(),
      pincode: branchForm.pincode.trim() || null,
      contact_person: branchForm.contact_person.trim() || null,
      contact_phone: branchForm.contact_phone.trim() || null,
    };
    if (!payload.branch_code || !payload.branch_name || !payload.client_id || !payload.city || !payload.state) {
      setBranchError("Enter branch code, branch name, client, city, and state.");
      setSavingBranch(false);
      return;
    }
    try {
      await apiRequest("/branches", { method: "POST", body: JSON.stringify(payload) });
      setBranchMessage("Branch created successfully.");
      setBranchForm({ branch_code: "", branch_name: "", client_id: "", address: "", city: "", state: "", pincode: "", contact_person: "", contact_phone: "" });
      setActiveTab("Branches");
      await onBranchesCreated?.();
      setShowBranchForm(false);
    } catch (err) {
      setBranchError(err.message || "Could not create branch.");
    } finally {
      setSavingBranch(false);
    }
  }

  const config = {
    Branches: {
      rows: branches,
      columns: [
        { key: "branch_code", label: "Branch ID", render: (r) => r.branch_code || r.id },
        { key: "branch_name", label: "Branch name", render: (r) => r.branch_name || r.name },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
        { key: "client_id", label: "Client ID" },
      ],
    },
    Sites: {
      rows: sites,
      columns: [
        { key: "site_code", label: "Site ID", render: (r) => r.site_code || r.id },
        { key: "site_name", label: "Site name", render: (r) => r.site_name || r.name },
        { key: "branch_id", label: "Branch ID" },
        { key: "address", label: "Address" },
        { key: "city", label: "City" },
      ],
    },
    "Security Posts": {
      rows: posts,
      columns: [
        { key: "post_code", label: "Post ID", render: (r) => r.post_code || r.id },
        { key: "post_name", label: "Post name", render: (r) => r.post_name || r.name },
        { key: "site_id", label: "Site ID" },
        { key: "required_guards", label: "Required guards" },
        { key: "shift_type", label: "Shift" },
        { key: "is_armed", label: "Armed", render: (r) => r.is_armed ? "YES" : "NO" },
        { key: "is_active", label: "Status", render: (r) => r.is_active === undefined ? r.status : r.is_active ? "ACTIVE" : "INACTIVE", status: true },
      ],
    },
  };

  return (
    <div className="page-content">
      <div className="page-intro">
        <div><span className="eyebrow">LOCATION MANAGEMENT</span><h1>Sites &amp; Posts</h1><p>Manage branches, security sites and guard posts.</p></div>
        <button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} />Refresh</button>
      </div>

      <div className="location-summary-grid">
        {[
          { name: "Branches", count: branches.length, icon: Building2 },
          { name: "Sites", count: sites.length, icon: MapPin },
          { name: "Security Posts", count: posts.length, icon: DoorOpen },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button className="location-summary-card" key={item.name} onClick={() => setActiveTab(item.name)}>
              <span className="location-summary-icon location-icon-blue"><Icon size={20} /></span>
              <span className="location-summary-copy"><span>{item.name}</span><strong>{item.count}</strong></span>
            </button>
          );
        })}
      </div>

      {activeTab === "Branches" && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button className="primary-button" type="button" onClick={() => { setShowBranchForm((v) => !v); setBranchError(""); setBranchMessage(""); }}>
            {showBranchForm ? "Cancel" : "+ Add Branch"}
          </button>
        </div>
      )}
      {activeTab === "Sites" && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button className="primary-button" type="button" onClick={() => { setShowSiteForm((v) => !v); setSiteError(""); setSiteMessage(""); }}>
            {showSiteForm ? "Cancel" : "+ Add Site"}
          </button>
        </div>
      )}
      {activeTab === "Security Posts" && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button className="primary-button" type="button" onClick={() => { setShowPostForm((v) => !v); setPostError(""); setPostMessage(""); }}>
            {showPostForm ? "Cancel" : "+ Add Security Post"}
          </button>
        </div>
      )}
      {branchMessage && <p className="success-message" role="status">{branchMessage}</p>}
      {siteMessage && <p className="success-message" role="status">{siteMessage}</p>}
      {postMessage && <p className="success-message" role="status">{postMessage}</p>}
      {showBranchForm && activeTab === "Branches" && (
        <section className="panel" style={{ marginBottom: 20, padding: 22 }}>
          <SectionHeading title="Create a branch" subtitle="Choose the client that owns this branch. Fields marked * are required." />
          <form onSubmit={submitBranch}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 18 }}>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Branch code *
                <input className="form-field" name="branch_code" value={branchForm.branch_code} onChange={updateBranchField} required minLength={3} maxLength={30} placeholder="e.g. BR-002" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Branch name *
                <input className="form-field" name="branch_name" value={branchForm.branch_name} onChange={updateBranchField} required minLength={2} maxLength={150} placeholder="e.g. Chennai Branch" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Client *
                <select className="form-field" name="client_id" value={branchForm.client_id} onChange={updateBranchField} required>
                  <option value="">Select a client</option>
                  {clients.filter((client) => client.is_active !== false).map((client) => <option key={client.id} value={client.id}>{client.client_code} — {client.company_name}</option>)}
                </select>
                {clients.length === 0 && <span className="small-muted">No clients loaded. Refresh the page or check your access to Clients.</span>}
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>City *
                <input className="form-field" name="city" value={branchForm.city} onChange={updateBranchField} required minLength={2} maxLength={100} placeholder="City" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>State *
                <input className="form-field" name="state" value={branchForm.state} onChange={updateBranchField} required minLength={2} maxLength={100} placeholder="State" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Address
                <input className="form-field" name="address" value={branchForm.address} onChange={updateBranchField} placeholder="Street address" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>PIN code
                <input className="form-field" name="pincode" value={branchForm.pincode} onChange={updateBranchField} maxLength={10} placeholder="PIN code" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Contact person
                <input className="form-field" name="contact_person" value={branchForm.contact_person} onChange={updateBranchField} maxLength={100} placeholder="Contact person's name" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Contact phone
                <input className="form-field" name="contact_phone" value={branchForm.contact_phone} onChange={updateBranchField} maxLength={20} placeholder="Phone number" />
              </label>
            </div>
            <ErrorMessage message={branchError} />
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="primary-button" type="submit" disabled={savingBranch || clients.length === 0}>{savingBranch ? "Creating branch..." : "Create Branch"}</button>
              <button className="secondary-button" type="button" disabled={savingBranch} onClick={() => setShowBranchForm(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      {showSiteForm && activeTab === "Sites" && (
        <section className="panel" style={{ marginBottom: 20, padding: 22 }}>
          <SectionHeading title="Create a site" subtitle="Select the branch where this security site is located. Fields marked * are required." />
          <form onSubmit={submitSite}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 18 }}>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Site code *
                <input className="form-field" name="site_code" value={siteForm.site_code} onChange={updateSiteField} required minLength={3} maxLength={30} placeholder="e.g. SITE-002" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Site name *
                <input className="form-field" name="site_name" value={siteForm.site_name} onChange={updateSiteField} required minLength={2} maxLength={150} placeholder="e.g. Chennai Warehouse" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Branch *
                <select className="form-field" name="branch_id" value={siteForm.branch_id} onChange={updateSiteField} required>
                  <option value="">Select a branch</option>
                  {branches.filter((branch) => branch.is_active !== false).map((branch) => <option key={branch.id} value={branch.id}>{branch.branch_code} — {branch.branch_name}</option>)}
                </select>
                {branches.length === 0 && <span className="small-muted">No branches loaded. Create a branch first or refresh the page.</span>}
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Address *
                <input className="form-field" name="address" value={siteForm.address} onChange={updateSiteField} onBlur={() => setSiteForm((current) => ({ ...current, address: current.address.trim() }))} required minLength={3} placeholder="Full site address" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>City *
                <input className="form-field" name="city" value={siteForm.city} onChange={updateSiteField} required minLength={2} maxLength={100} placeholder="City" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>State *
                <input className="form-field" name="state" value={siteForm.state} onChange={updateSiteField} required minLength={2} maxLength={100} placeholder="State" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Site contact
                <input className="form-field" name="site_contact" value={siteForm.site_contact} onChange={updateSiteField} maxLength={100} placeholder="Contact person's name" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Contact phone
                <input className="form-field" name="contact_phone" value={siteForm.contact_phone} onChange={updateSiteField} maxLength={20} placeholder="Phone number" />
              </label>
            </div>
            <ErrorMessage message={siteError} />
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="primary-button" type="submit" disabled={savingSite || branches.length === 0}>{savingSite ? "Creating site..." : "Create Site"}</button>
              <button className="secondary-button" type="button" disabled={savingSite} onClick={() => setShowSiteForm(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      {showPostForm && activeTab === "Security Posts" && (
        <section className="panel" style={{ marginBottom: 20, padding: 22 }}>
          <SectionHeading title="Create a security post" subtitle="Choose a site and define the guard requirement and shift." />
          <form onSubmit={submitPost}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 18 }}>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Post code *
                <input className="form-field" name="post_code" value={postForm.post_code} onChange={updatePostField} required minLength={3} maxLength={30} placeholder="e.g. POST-002" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Post name *
                <input className="form-field" name="post_name" value={postForm.post_name} onChange={updatePostField} required minLength={2} maxLength={120} placeholder="e.g. Main Gate" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Site *
                <select className="form-field" name="site_id" value={postForm.site_id} onChange={updatePostField} required>
                  <option value="">Select a site</option>
                  {sites.filter((site) => site.is_active !== false).map((site) => <option key={site.id} value={site.id}>{site.site_code} — {site.site_name}</option>)}
                </select>
                {sites.length === 0 && <span className="small-muted">Create a site first or refresh the page.</span>}
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Required guards *
                <input className="form-field" name="required_guards" type="number" value={postForm.required_guards} onChange={updatePostField} required min="1" max="500" step="1" />
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Shift type *
                <select className="form-field" name="shift_type" value={postForm.shift_type} onChange={updatePostField} required>
                  <option value="GENERAL">General</option><option value="DAY">Day</option><option value="NIGHT">Night</option><option value="ROTATIONAL">Rotational</option><option value="24_HOURS">24 Hours</option>
                </select>
              </label>
              <label className="form-field-wrap" style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600 }}>Description
                <textarea className="form-field" name="description" value={postForm.description} onChange={updatePostField} rows="3" placeholder="Optional duties or instructions" />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" name="is_armed" checked={postForm.is_armed} onChange={updatePostField} /> Armed security post
              </label>
            </div>
            <ErrorMessage message={postError} />
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="primary-button" type="submit" disabled={savingPost || sites.length === 0}>{savingPost ? "Creating post..." : "Create Security Post"}</button>
              <button className="secondary-button" type="button" disabled={savingPost} onClick={() => setShowPostForm(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      <section className="panel table-panel">
        <div className="site-tabs">
          {Object.keys(config).map((tab) => (
            <button key={tab} className={`site-tab ${activeTab === tab ? "site-tab-active" : ""}`} onClick={() => setActiveTab(tab)}>
              {tab}<span>{config[tab].rows.length}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: "18px 22px 0" }}><ErrorMessage message={error} onRetry={onRefresh} /></div>
        <DataTable rows={config[activeTab].rows} columns={config[activeTab].columns} loading={loading} />
      </section>
    </div>
  );
}

function DeploymentsPage({ guards = [], posts = [], ...props }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [replaceTarget, setReplaceTarget] = useState(null);
  const replacementFormRef = useRef(null);

    useEffect(() => {
      if (replaceTarget && replacementFormRef.current) {
        replacementFormRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, [replaceTarget]);
  const [replacementGuardId, setReplacementGuardId] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    guard_id: "", security_post_id: "", start_date: today, end_date: "", shift_type: "GENERAL", notes: "",
  });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitDeployment(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFormMessage("");
    const payload = {
      guard_id: Number(form.guard_id),
      security_post_id: Number(form.security_post_id),
      start_date: form.start_date,
      end_date: form.end_date || null,
      shift_type: form.shift_type.trim().toUpperCase(),
      notes: form.notes.trim() || null,
    };
    if (!payload.guard_id || !payload.security_post_id || !payload.start_date || !payload.shift_type) {
      setFormError("Select a guard and security post, and enter the start date and shift.");
      setSaving(false);
      return;
    }
    if (payload.start_date > today) {
      setFormError("Deployment start date cannot be in the future.");
      setSaving(false);
      return;
    }
    if (payload.end_date && payload.end_date < payload.start_date) {
      setFormError("End date cannot be before the start date.");
      setSaving(false);
      return;
    }
    try {
      await apiRequest("/deployments/", { method: "POST", body: JSON.stringify(payload) });
      setFormMessage("Guard deployment created successfully.");
      setForm({ guard_id: "", security_post_id: "", start_date: today, end_date: "", shift_type: "GENERAL", notes: "" });
      await props.onRefresh?.();
      setShowForm(false);
    } catch (err) {
      setFormError(err.message || "Could not create deployment.");
    } finally {
      setSaving(false);
    }
  }

  async function submitReplacement(event) {
    event.preventDefault();
    if (!replaceTarget || !replacementGuardId || replacementReason.trim().length < 3) {
      setActionError("Select a replacement guard and provide a reason of at least 3 characters.");
      return;
    }

    setActionLoading(true);
    setActionError("");
    setActionMessage("");
    try {
      await apiRequest(`/deployments/${replaceTarget.id}/replace`, {
        method: "POST",
        body: JSON.stringify({
          replacement_guard_id: Number(replacementGuardId),
          reason: replacementReason.trim(),
        }),
      });
      setActionMessage(`Guard replaced successfully for deployment #${replaceTarget.id}.`);
      setReplaceTarget(null);
      setReplacementGuardId("");
      setReplacementReason("");
      await props.onRefresh?.();
    } catch (err) {
      setActionError(err.message || "Could not replace guard.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <RecordsPage
      {...props}
      title="Deployments"
      subtitle="Assign active guards to security posts and shifts."
      columns={[
        { key: "id", label: "Deployment ID" },
        { key: "guard_id", label: "Guard ID" },
        { key: "security_post_id", label: "Post ID", render: (r) => r.security_post_id ?? r.post_id },
        { key: "start_date", label: "Start date" },
        { key: "end_date", label: "End date" },
        { key: "shift_type", label: "Shift", render: (r) => r.shift_type || r.shift },
        { key: "status", label: "Status", status: true },
        {
          key: "actions",
          label: "Actions",
          render: (r) => r.status === "ACTIVE" ? (
            <button
              type="button"
              className="secondary-button"
              disabled={actionLoading}
              onClick={() => {
                setReplaceTarget(r);
                setReplacementGuardId("");
                setReplacementReason("");
                setActionError("");
                setActionMessage("");
              }}
            >
              Replace Guard
            </button>
          ) : "—",
        },
      ]}
      emptyMessage="Deployment records will appear here when available."
    >
      <div className="page-actions">
        <button className="primary-button" type="button" onClick={() => { setShowForm((value) => !value); setFormError(""); }}>
          {showForm ? "Close Form" : "+ Add Deployment"}
        </button>
      </div>

      {formMessage && <div className="success-message" role="status">{formMessage}</div>}
      {actionMessage && <div className="success-message" role="status">{actionMessage}</div>}
      {actionError && <div className="error-banner" role="alert">{actionError}</div>}

      
      
      {replaceTarget && (
          <section
            className="form-card replacement-form-card"
            ref={replacementFormRef}
          >
          <div className="form-card-heading">
            <h3>Replace Guard — Deployment #{replaceTarget.id}</h3>
            <p>Current guard: #{replaceTarget.guard_id}. Select a different active guard and record the reason.</p>
          </div>
          <form onSubmit={submitReplacement}>
            <div className="form-grid">
              <label className="form-field">Replacement guard *
                <select value={replacementGuardId} onChange={(event) => setReplacementGuardId(event.target.value)} required>
                  <option value="">Select a guard</option>
                  {guards
                    .filter((g) => Number(g.id) !== Number(replaceTarget.guard_id) && g.is_active !== false && (g.employment_status || "ACTIVE") === "ACTIVE")
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.security_id ? `${g.security_id} — ` : ""}{g.full_name || `Guard ${g.id}`}
                      </option>
                    ))}
                </select>
              </label>
              <label className="form-field">Reason for replacement *
                <textarea
                  value={replacementReason}
                  onChange={(event) => setReplacementReason(event.target.value)}
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  placeholder="e.g. Original guard unavailable"
                  required
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={actionLoading}>
                {actionLoading ? "Processing..." : "Confirm Replacement"}
              </button>
              <button className="secondary-button" type="button" disabled={actionLoading} onClick={() => { setReplaceTarget(null); setActionError(""); }}>
                Cancel
              </button>
            </div>
            {guards.filter((g) => Number(g.id) !== Number(replaceTarget.guard_id) && g.is_active !== false && (g.employment_status || "ACTIVE") === "ACTIVE").length === 0 && (
              <p className="form-hint">No other active guards are available for replacement.</p>
            )}
          </form>
        </section>
      )}

      {showForm && (
        <section className="form-card">
          <div className="form-card-heading"><h3>Create Guard Deployment</h3><p>Choose an active guard, a security post, and the shift to assign.</p></div>
          <form onSubmit={submitDeployment}>
            <div className="form-grid">
              <label className="form-field">Guard *
                <select name="guard_id" value={form.guard_id} onChange={updateField} required>
                  <option value="">Select a guard</option>
                  {guards.filter((g) => g.is_active !== false && (g.employment_status || "ACTIVE") === "ACTIVE").map((g) => (
                    <option key={g.id} value={g.id}>{g.security_id ? `${g.security_id} — ` : ""}{g.full_name || `Guard ${g.id}`}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">Security post *
                <select name="security_post_id" value={form.security_post_id} onChange={updateField} required>
                  <option value="">Select a security post</option>
                  {posts.filter((post) => post.is_active !== false).map((post) => (
                    <option key={post.id} value={post.id}>{post.post_code ? `${post.post_code} — ` : ""}{post.post_name || `Post ${post.id}`} (needs {post.required_guards ?? 1})</option>
                  ))}
                </select>
              </label>
              <label className="form-field">Start date *
                <input type="date" name="start_date" value={form.start_date} max={today} onChange={updateField} required />
              </label>
              <label className="form-field">End date (optional)
                <input type="date" name="end_date" value={form.end_date} min={form.start_date || undefined} onChange={updateField} />
              </label>
              <label className="form-field">Shift type *
                <select name="shift_type" value={form.shift_type} onChange={updateField} required>
                  <option value="GENERAL">General</option><option value="DAY">Day</option><option value="NIGHT">Night</option><option value="ROTATIONAL">Rotational</option><option value="24 HOURS">24 Hours</option>
                </select>
              </label>
              <label className="form-field">Notes
                <input type="text" name="notes" value={form.notes} onChange={updateField} maxLength={500} placeholder="Optional deployment notes" />
              </label>
            </div>
            {formError && <div className="error-banner"><span>{formError}</span></div>}
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={saving}>{saving ? "Creating deployment..." : "Create Deployment"}</button>
              <button className="secondary-button" type="button" disabled={saving} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
          {guards.filter((g) => g.is_active !== false && (g.employment_status || "ACTIVE") === "ACTIVE").length === 0 && <p className="form-hint">No active guards are available. Create or reactivate a guard first.</p>}
          {posts.filter((post) => post.is_active !== false).length === 0 && <p className="form-hint">No active security posts are available. Create a site and security post first.</p>}
        </section>
      )}
    </RecordsPage>
  );
}



function ReplacementHistoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        "/deployments/replacement-history"
      );

      setRows(getList(data, ["history", "replacements"]));
    } catch (err) {
      setError(err.message || "Could not load replacement history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredRows = rows.filter((row) =>
    [
      row.outgoing_guard_name,
      row.incoming_guard_name,
      row.post_name,
      row.shift_type,
      row.reason,
      row.replacement_date,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const columns = [
    {
      key: "id",
      label: "Record ID",
      render: (row) => `#${row.id}`,
    },
    {
      key: "outgoing_guard_name",
      label: "Outgoing Guard",
    },
    {
      key: "incoming_guard_name",
      label: "Replacement Guard",
    },
    {
      key: "post_name",
      label: "Security Post",
    },
    {
      key: "replacement_date",
      label: "Replacement Date",
    },
    {
      key: "shift_type",
      label: "Shift",
      render: (row) => label(row.shift_type),
    },
    {
      key: "reason",
      label: "Reason",
    },
  ];

  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">WORKFORCE MANAGEMENT</span>
          <h1>Replacement History</h1>
          <p>
            Track guard replacements, incoming personnel,
            security posts and replacement reasons.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadHistory}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="stat-grid">
        <StatCard
          title="Total Replacements"
          value={rows.length}
          subtitle="Recorded replacement events"
          icon={Users}
          tone="blue"
        />

        <StatCard
          title="Unique Security Posts"
          value={
            new Set(rows.map((row) => row.security_post_id)).size
          }
          subtitle="Posts with replacement records"
          icon={MapPin}
          tone="purple"
        />
      </div>

      <section className="panel table-panel">
        <div
          className="section-heading"
          style={{ padding: "0 22px" }}
        >
          <div>
            <h3>Guard replacement records</h3>
            <p>
              {filteredRows.length} record(s) displayed
            </p>
          </div>
        </div>

        <div className="table-toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search guards, posts or reasons..."
          />
        </div>

        <ErrorMessage
          message={error}
          onRetry={loadHistory}
        />

        <DataTable
          rows={filteredRows}
          columns={columns}
          loading={loading}
          emptyMessage={
            search
              ? "No replacement records match your search."
              : "No guard replacements have been recorded yet."
          }
        />
      </section>
    </div>
  );
}



function AttendancePage({ rows, deployments = [], guards = [], posts = [], loading, error, onRefresh }) {
  const [deploymentId, setDeploymentId] = useState("");
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState(null);

  const activeDeployments = deployments.filter((deployment) => {
    if (deployment.status !== "ACTIVE") return false;
    const today = new Date().toLocaleDateString("en-CA");
    if (deployment.start_date && deployment.start_date > today) return false;
    if (deployment.end_date && deployment.end_date < today) return false;
    return !rows.some((row) =>
      String(row.deployment_id) === String(deployment.id) &&
      row.attendance_date === today
    );
  });

  const guardName = (guardId) => {
    const guard = guards.find((item) => Number(item.id) === Number(guardId));
    return guard ? `${guard.security_id ? `${guard.security_id} — ` : ""}${guard.full_name}` : `Guard #${guardId ?? "—"}`;
  };

  const postName = (postId) => {
    const post = posts.find((item) => Number(item.id) === Number(postId));
    return post ? `${post.post_code ? `${post.post_code} — ` : ""}${post.post_name}` : `Post #${postId ?? "—"}`;
  };

  const deploymentLabel = (deployment) => {
    const guard = guardName(deployment.guard_id);
    const post = postName(deployment.security_post_id);
    return `${guard} · ${post} · ${label(deployment.shift_type)} (Deployment #${deployment.id})`;
  };

  const formatDateTime = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("en-IN", {
      dateStyle: "medium", timeStyle: "short"
    });
  };

  async function checkIn(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      await apiRequest("/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({
          deployment_id: Number(deploymentId),
          notes: notes.trim() || null,
        }),
      });
      setActionMessage("Check-in recorded successfully.");
      setDeploymentId("");
      setNotes("");
      await onRefresh();
    } catch (err) {
      setActionError(err.message || "Could not record check-in.");
    } finally {
      setSaving(false);
    }
  }

  async function checkOut(row) {
    if (!row.id || row.check_out || checkingOutId !== null) return;
    setCheckingOutId(row.id);
    setActionError("");
    setActionMessage("");
    try {
      await apiRequest(`/attendance/${row.id}/check-out`, { method: "POST" });
      setActionMessage(`Check-out recorded for ${guardName(row.guard_id)}.`);
      await onRefresh();
    } catch (err) {
      setActionError(err.message || "Could not record check-out.");
    } finally {
      setCheckingOutId(null);
    }
  }

  return (
    <RecordsPage
      title="Attendance"
      subtitle="Record check-ins, track shift attendance, and check guards out at the end of their shifts."
      rows={rows}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      columns={[
        { key: "id", label: "Record ID" },
        { key: "guard_id", label: "Guard", render: (row) => guardName(row.guard_id) },
        { key: "deployment_id", label: "Deployment", render: (row) => `#${row.deployment_id} · ${postName(deployments.find((d) => Number(d.id) === Number(row.deployment_id))?.security_post_id)}` },
        { key: "attendance_date", label: "Date" },
        { key: "check_in", label: "Check-in", render: (row) => formatDateTime(row.check_in) },
        { key: "check_out", label: "Check-out", render: (row) => formatDateTime(row.check_out) },
        { key: "status", label: "Status", status: true },
        {
          key: "actions",
          label: "Actions",
          render: (row) => row.check_out
            ? <span className="small-muted">Shift completed</span>
            : row.id
              ? <button className="table-action-button" disabled={checkingOutId !== null} onClick={() => checkOut(row)}>{checkingOutId === row.id ? "Checking out…" : "Check out"}</button>
              : "—",
        },
      ]}
      emptyMessage="Attendance records will appear here after a guard checks in."
    >
      <section className="panel attendance-checkin-card" style={{ marginBottom: 20 }}>
        <SectionHeading title="Record guard check-in" subtitle="Choose an active deployment. The guard is linked automatically from that deployment." />
        <form onSubmit={checkIn} className="attendance-checkin-form">
          <label className="form-field">
            Active deployment *
            <select value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)} required>
              <option value="">Select a guard and post</option>
              {activeDeployments.map((deployment) => (
                <option key={deployment.id} value={deployment.id}>{deploymentLabel(deployment)}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Notes (optional)
            <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="Add a shift note, if needed" />
          </label>
          <div className="attendance-checkin-submit">
            <button className="primary-button" type="submit" disabled={saving || !deploymentId}>{saving ? "Recording check-in…" : "Check in guard"}</button>
          </div>
        </form>
        {actionError && <ErrorMessage message={actionError} />}
        {actionMessage && <p className="success-message" role="status">{actionMessage}</p>}
        {activeDeployments.length === 0 && (
          <p className="form-hint">No eligible deployments are available for check-in today. Check that a guard has an active deployment and has not already checked in today.</p>
        )}
      </section>
    </RecordsPage>
  );
}

function LeavePage({ rows = [], guards = [], currentUser, loading, error, onRefresh }) {
  const role = String(currentUser?.role || "").toUpperCase();
  const managerRoles = ["SUPER_ADMIN", "HR", "OPERATIONS_MANAGER"];
  const canManage = managerRoles.includes(role);
  const canApply = canManage || role === "GUARD";

  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Use local calendar dates to avoid UTC date shifts in browsers in India.
  const localToday = new Date();
  const today = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, "0")}-${String(localToday.getDate()).padStart(2, "0")}`;

  const [form, setForm] = useState({
    guard_id: "",
    start_date: today,
    end_date: today,
    reason: "",
  });

  const guardName = (guardId) => {
    const guard = guards.find((item) => Number(item.id) === Number(guardId));
    return guard
      ? `${guard.full_name || guard.name || "Guard"} (${guard.security_id || `ID ${guard.id}`})`
      : `Guard ID ${guardId ?? "—"}`;
  };

  const pendingCount = rows.filter((row) => String(row.status || "").toUpperCase() === "PENDING").length;
  const approvedCount = rows.filter((row) => String(row.status || "").toUpperCase() === "APPROVED").length;
  const rejectedCount = rows.filter((row) => String(row.status || "").toUpperCase() === "REJECTED").length;

  const filteredRows = rows.filter((row) => {
    const rowStatus = String(row.status || "").toUpperCase();
    const matchesStatus = statusFilter === "ALL" || rowStatus === statusFilter;
    const searchable = [row.id, guardName(row.guard_id), row.start_date, row.end_date, row.reason, row.status].join(" ").toLowerCase();
    return matchesStatus && searchable.includes(search.toLowerCase());
  });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setActionError("");
  }

  async function submitLeave(event) {
    event.preventDefault();
    setActionError("");
    setActionMessage("");

    if (canManage && !form.guard_id) {
      setActionError("Please select a guard.");
      return;
    }
    if (form.end_date < form.start_date) {
      setActionError("End date cannot be before start date.");
      return;
    }
    if (!form.reason.trim()) {
      setActionError("Please enter a reason.");
      return;
    }

    setSavingRequest(true);
    try {
      const payload = {
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason.trim(),
      };
      // Guard accounts are linked to their own guard record by the API.
      if (canManage) payload.guard_id = Number(form.guard_id);

      await apiRequest("/leaves/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setActionMessage("Leave request submitted successfully. It is now pending review.");
      setForm({ guard_id: "", start_date: today, end_date: today, reason: "" });
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      setActionError(err.message || "Could not submit leave request.");
    } finally {
      setSavingRequest(false);
    }
  }

  async function review(row, nextStatus) {
    const id = row.id ?? row.leave_id;
    if (!id) {
      setActionError("Leave request ID is missing.");
      return;
    }

    setSavingId(id);
    setActionError("");
    setActionMessage("");
    try {
      await apiRequest(`/leaves/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setActionMessage(`Leave request #${id} ${nextStatus.toLowerCase()} successfully.`);
      await onRefresh();
    } catch (err) {
      setActionError(err.message || "Could not review leave request.");
    } finally {
      setSavingId(null);
    }
  }

  const leaveColumns = [
    { key: "id", label: "Request ID", render: (row) => `#${row.id ?? row.leave_id}` },
    { key: "guard", label: "Guard", render: (row) => guardName(row.guard_id) },
    { key: "start_date", label: "Start Date" },
    { key: "end_date", label: "End Date" },
    { key: "reason", label: "Reason", render: (row) => row.reason || "—" },
    { key: "status", label: "Status", status: true },
    ...(canManage ? [{
      key: "review",
      label: "Actions",
      render: (row) => {
        const id = row.id ?? row.leave_id;
        if (String(row.status || "").toUpperCase() !== "PENDING") return "Reviewed";
        return (
          <div className="action-buttons">
            <button className="table-action-button" disabled={savingId === id} onClick={() => review(row, "APPROVED")}>
              {savingId === id ? "Saving..." : "Approve"}
            </button>
            <button className="table-action-button table-action-danger" disabled={savingId === id} onClick={() => review(row, "REJECTED")}>
              Reject
            </button>
          </div>
        );
      },
    }] : []),
  ];

  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">OPERATIONS MANAGEMENT</span>
          <h1>Leave Requests</h1>
          <p>{canManage ? "Create requests for guards and review pending applications." : "Submit leave applications and track their review status."}</p>
        </div>
        <div className="page-actions">
          <button className="secondary-button" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          {canApply && (
            <button className="primary-button" onClick={() => { setShowForm((value) => !value); setActionError(""); setActionMessage(""); }}>
              {showForm ? "Close Form" : "+ New Leave Request"}
            </button>
          )}
        </div>
      </div>

      <ErrorMessage message={error} />
      <ErrorMessage message={actionError} />
      {actionMessage && <p className="success-message">{actionMessage}</p>}

      <div className="stat-grid">
        <StatCard title="Total Requests" value={rows.length} subtitle="Requests visible to your account" icon={FileText} tone="blue" />
        <StatCard title="Pending" value={pendingCount} subtitle="Awaiting manager review" icon={Clock3} tone="orange" />
        <StatCard title="Approved" value={approvedCount} subtitle="Approved leave requests" icon={CheckCircle2} tone="green" />
        <StatCard title="Rejected" value={rejectedCount} subtitle="Rejected leave requests" icon={AlertCircle} tone="red" />
      </div>

      {showForm && canApply && (
        <section className="panel leave-form-panel">
          <SectionHeading title="Create Leave Request" subtitle={canManage ? "Select the guard, leave dates and reason." : "Enter your leave dates and reason. Your account will be linked to your guard record."} />
          <form onSubmit={submitLeave}>
            <div className="form-grid">
              {canManage && (
                <label className="form-field-wrap">
                  Guard *
                  <select className="form-field" name="guard_id" value={form.guard_id} onChange={updateField} required disabled={savingRequest}>
                    <option value="">Select a guard</option>
                    {guards.filter((guard) => guard.is_active !== false && String(guard.employment_status || "ACTIVE").toUpperCase() === "ACTIVE").map((guard) => (
                      <option key={guard.id} value={guard.id}>{guard.security_id || `Guard ${guard.id}`} — {guard.full_name || guard.name || `Guard ${guard.id}`}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="form-field-wrap">
                Start Date *
                <input className="form-field" type="date" name="start_date" value={form.start_date} min={today} onChange={updateField} required disabled={savingRequest} />
              </label>
              <label className="form-field-wrap">
                End Date *
                <input className="form-field" type="date" name="end_date" value={form.end_date} min={form.start_date} onChange={updateField} required disabled={savingRequest} />
              </label>
              <label className="form-field-wrap" style={{ gridColumn: "1 / -1" }}>
                Reason for Leave *
                <textarea className="form-field" name="reason" value={form.reason} onChange={updateField} maxLength={500} rows={3} placeholder="Enter reason for leave" required disabled={savingRequest} />
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={savingRequest}>{savingRequest ? "Submitting..." : "Submit Request"}</button>
              <button className="secondary-button" type="button" onClick={() => setShowForm(false)} disabled={savingRequest}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      <section className="panel table-panel">
        <div className="section-heading">
          <div><h3>Leave Applications</h3><p>{filteredRows.length} matching request(s)</p></div>
        </div>
        <div className="table-toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search by guard, date, reason or ID..." />
          <select className="form-field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter leave status">
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button type="button" className="secondary-button export-button" disabled={loading || filteredRows.length === 0} onClick={() => exportRecordsToCSV(
            filteredRows.map((row) => ({ id: row.id ?? row.leave_id, guard: guardName(row.guard_id), start_date: row.start_date, end_date: row.end_date, reason: row.reason || "", status: row.status, reviewed_by: row.reviewed_by ?? "", reviewed_at: row.reviewed_at ?? "", created_at: row.created_at ?? "" })),
            [{ key: "id", label: "Request ID" }, { key: "guard", label: "Guard" }, { key: "start_date", label: "Start Date" }, { key: "end_date", label: "End Date" }, { key: "reason", label: "Reason" }, { key: "status", label: "Status" }, { key: "reviewed_by", label: "Reviewed By User ID" }, { key: "reviewed_at", label: "Reviewed At" }, { key: "created_at", label: "Created At" }],
            "leave-requests-export.csv"
          )}>
            <FileText size={16} /> Export CSV
          </button>
        </div>
        <DataTable rows={filteredRows} loading={loading} columns={leaveColumns} emptyMessage="No leave requests found." />
      </section>
    </div>
  );
}

function PayrollPage({ rows, guards = [], loading, error, onRefresh }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [guardId, setGuardId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function generate(event) {
    event.preventDefault();
    if (!guardId) {
      setActionError("Select a guard before generating payroll.");
      return;
    }
    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      await apiRequest("/payroll/generate", {
        method: "POST",
        body: JSON.stringify({
          guard_id: Number(guardId),
          month: Number(month),
          year: Number(year),
        }),
      });

      setActionMessage("Payroll generation request completed.");
      await onRefresh();
    } catch (err) {
      setActionError(err.message || "Could not generate payroll.");
    } finally {
      setSaving(false);
    }
  }

  async function payrollAction(row, action) {
    const id = row.id ?? row.payroll_id;
    if (!id) {
      setActionError("This payroll record has no ID.");
      return;
    }

    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const options = { method: "POST" };

      if (action === "pay") {
          if (!paymentReference.trim()) {
            setActionError("Enter a payment reference before marking payroll as paid.");
            setSaving(false);
            return;
          }

          options.body = JSON.stringify({
            payment_reference: paymentReference.trim(),
          });
      }

      await apiRequest(`/payroll/${id}/${action}`, options);
      setActionMessage(`Payroll record ${id}: ${action} request completed.`);
      await onRefresh();
    } catch (err) {
      setActionError(err.message || `Could not ${action} payroll.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-intro">
        <div><span className="eyebrow">FINANCE &amp; PAYMENTS</span><h1>Payroll</h1><p>Generate, approve and track payroll records.</p></div>
        <button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} />Refresh</button>
      </div>

      <section className="panel" style={{ marginBottom: 20 }}>
        <SectionHeading title="Generate payroll" subtitle="Create a payroll record for a guard and a selected month." />
        <form onSubmit={generate} className="payroll-generate-form">
          <label className="form-field-wrap payroll-guard-select">
            <span>Security guard</span>
            <select
              className="form-field"
              value={guardId}
              onChange={(event) => setGuardId(event.target.value)}
              required
              disabled={saving}
            >
              <option value="">
                {guards.length === 0 ? "No guards loaded — refresh the page" : "Choose a guard"}
              </option>
              {guards
                .filter((guard) => {
                  const status = String(guard.employment_status || "ACTIVE").toUpperCase();
                  return guard.is_active !== false && !["INACTIVE", "RELIEVED", "TERMINATED"].includes(status);
                })
                .map((guard) => (
                  <option key={guard.id} value={String(guard.id)}>
                    {guard.security_id || `Guard ${guard.id}`} — {guard.full_name || guard.name || `Guard ${guard.id}`}
                  </option>
                ))}
            </select>
            {guards.length > 0 && guards.filter((guard) => {
              const status = String(guard.employment_status || "ACTIVE").toUpperCase();
              return guard.is_active !== false && !["INACTIVE", "RELIEVED", "TERMINATED"].includes(status);
            }).length === 0 && (
              <small className="form-hint">No active guards available. Check the Guards page.</small>
            )}
          </label>
          <label className="payroll-field">
            <span>Payroll month</span>
            <select
              className="payroll-control"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              disabled={saving}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleString("en", { month: "long" })}
                </option>
              ))}
            </select>
          </label>

          <label className="payroll-field">
            <span>Payroll year</span>
            <input
              className="payroll-control"
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              required
              disabled={saving}
            />
          </label>
          <button className="primary-button" disabled={saving}>{saving ? "Processing..." : "Generate payroll"}</button>
        </form>
        <ErrorMessage message={actionError} />
        {actionMessage && <p className="success-message">{actionMessage}</p>}
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <SectionHeading title="Mark payroll as paid" subtitle="Enter the payment reference before recording a payment." />
        <div className="payroll-payment-form">
          <label className="payroll-field">
            <span>Payment reference</span>
            <input
              className="payroll-control"
              placeholder="Enter UPI / bank transaction reference"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              disabled={saving}
            />
          </label>
        </div>
        <p className="payroll-help-text">
          Enter the reference, then click Mark paid against the corresponding
          approved payroll record.
        </p>
      </section>

      <section className="panel table-panel">
        <div className="section-heading" style={{ padding: "0 22px" }}>
          <div><h3>Payroll records</h3><p>{rows.length} record(s) returned by the API</p></div>
        </div>
        <DataTable
          rows={rows}
          loading={loading}
          columns={[
            { key: "id", label: "Payroll ID", render: (r) => r.id ?? r.payroll_id },
            { key: "guard_id", label: "Guard ID" },
            { key: "month", label: "Month" },
            { key: "year", label: "Year" },
            { key: "monthly_salary", label: "Salary", render: (r) => money(r.monthly_salary) },
            { key: "present_days", label: "Present days" },
            { key: "payable_amount", label: "Payable", render: (r) => money(r.payable_amount) },
            { key: "status", label: "Status", status: true },
            {
              key: "actions",
              label: "Actions",
              render: (row) => {
                const status = String(row.status || "").toUpperCase();
                if (status === "DRAFT") {
                  return <button disabled={saving} className="table-action-button" onClick={() => payrollAction(row, "approve")}>Approve</button>;
                }
                if (status === "APPROVED") {
                  return <button disabled={saving || !paymentReference.trim()} className="table-action-button" onClick={() => payrollAction(row, "pay")}>Mark paid</button>;
                }
                return status === "PAID" ? "Paid" : "—";
              },
            },
          ]}
          emptyMessage="Generate payroll to create records."
        />
      </section>
    </div>
  );
}

function PlaceholderPage({ activePage }) {
  const descriptions = {
    "Leave Requests": "Review applications and track approval status.",
    Payroll: "Generate payroll, review approvals and track payments.",
    Deployments: "View guard assignments and shift allocations.",
    Attendance: "Monitor guard check-ins and check-outs.",
  };

  return (
    <div className="page-content">
      <div className="page-intro">
        <div><span className="eyebrow">OPERATIONS MANAGEMENT</span><h1>{activePage}</h1><p>{descriptions[activePage]}</p></div>
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const [guards, setGuards] = useState([]);
  const [guardsLoading, setGuardsLoading] = useState(false);
  const [guardsError, setGuardsError] = useState("");

  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState("");

  const [branches, setBranches] = useState([]);
  const [sites, setSites] = useState([]);
  const [posts, setPosts] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState("");

  const [deployments, setDeployments] = useState([]);
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);
  const [deploymentsError, setDeploymentsError] = useState("");

  const [attendance, setAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");

  const [leaves, setLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesError, setLeavesError] = useState("");

  const [payroll, setPayroll] = useState([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollError, setPayrollError] = useState("");

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError("");
    try {
      setDashboard(await apiRequest("/dashboard/operations"));
    } catch (err) {
      setDashboardError(err.message);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadGuards = useCallback(async () => {
    setGuardsLoading(true);
    setGuardsError("");
    try {
      setGuards(getList(await apiRequest("/guards/"), ["guards"]));
    } catch (err) {
      setGuardsError(err.message);
    } finally {
      setGuardsLoading(false);
    }
  }, []);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    setClientsError("");
    try {
      setClients(getList(await apiRequest("/clients/"), ["clients"]));
    } catch (err) {
      setClientsError(err.message);
    } finally {
      setClientsLoading(false);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    setLocationsLoading(true);
    setLocationsError("");
    try {
      const [branchData, siteData, postData] = await Promise.all([
        apiRequest("/branches/"),
        apiRequest("/sites/"),
        apiRequest("/security-posts/"),
      ]);
      setBranches(getList(branchData, ["branches"]));
      setSites(getList(siteData, ["sites"]));
      setPosts(getList(postData, ["security_posts", "posts"]));
    } catch (err) {
      setLocationsError(err.message);
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  const loadDeployments = useCallback(async () => {
    setDeploymentsLoading(true);
    setDeploymentsError("");
    try {
      setDeployments(getList(await apiRequest("/deployments/"), ["deployments"]));
    } catch (err) {
      setDeploymentsError(err.message);
    } finally {
      setDeploymentsLoading(false);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      setAttendance(getList(await apiRequest("/attendance/"), ["attendance", "records"]));
    } catch (err) {
      setAttendanceError(err.message);
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  const loadLeaves = useCallback(async () => {
    setLeavesLoading(true);
    setLeavesError("");
    try {
      setLeaves(getList(await apiRequest("/leaves/"), ["leaves", "requests"]));
    } catch (err) {
      setLeavesError(err.message);
    } finally {
      setLeavesLoading(false);
    }
  }, []);

  const loadPayroll = useCallback(async () => {
    setPayrollLoading(true);
    setPayrollError("");
    try {
      setPayroll(getList(await apiRequest("/payroll/"), ["payroll", "records"]));
    } catch (err) {
      setPayrollError(err.message);
    } finally {
      setPayrollLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activePage === "Dashboard") {
      loadDashboard();
      loadClients();
    } else if (activePage === "Guards") {
      loadGuards();
    } else if (activePage === "Clients") {
      loadClients();
    } else if (activePage === "Sites & Posts") {
      loadLocations();
      loadClients();
    } else if (activePage === "Deployments") {
      loadDeployments();
      loadGuards();
      loadLocations();
    }else if (activePage === "Attendance") {
      loadAttendance();
      loadDeployments();
      loadGuards();
      loadLocations();
    }else if (activePage === "Leave Requests") {
      loadLeaves();
      loadGuards();
    }else if (activePage === "Payroll") {
      loadPayroll();
      loadGuards();
    }
  }, [
    activePage,
    loadDashboard,
    loadClients,
    loadGuards,
    loadLocations,
    loadDeployments,
    loadAttendance,
    loadLeaves,
    loadPayroll,
  ]);

  const refresh = useCallback(() => {
    const actions = {
      Dashboard: () => { loadDashboard(); loadClients(); },
      Guards: loadGuards,
      Clients: loadClients,
      "Sites & Posts": loadLocations,
      Deployments: () => { loadDeployments(); loadGuards(); loadLocations(); },
      Attendance: () => { loadAttendance(); loadDeployments(); loadGuards(); loadLocations(); },
      "Leave Requests": () => { loadLeaves(); loadGuards(); },
      Payroll: () => { loadPayroll(); loadGuards(); },
    };

    actions[activePage]?.();
  }, [
    activePage,
    loadDashboard,
    loadClients,
    loadGuards,
    loadLocations,
    loadDeployments,
    loadAttendance,
    loadLeaves,
    loadPayroll,
  ]);

  const loadingByPage = {
    Dashboard: dashboardLoading,
    Guards: guardsLoading,
    Clients: clientsLoading,
    "Sites & Posts": locationsLoading,
    Deployments: deploymentsLoading,
    Attendance: attendanceLoading,
    "Leave Requests": leavesLoading,
    Payroll: payrollLoading,
  };

  function renderPage() {
    if (activePage === "Dashboard") {
      return <DashboardHome dashboard={dashboard} dashboardError={dashboardError} loading={dashboardLoading} clients={clients} />;
    }

    if (activePage === "Guards") {
      return <GuardsPage title="Guards" subtitle="View registered security personnel." rows={guards} loading={guardsLoading} error={guardsError} onRefresh={loadGuards} onCreate={loadGuards} />;
    }

    if (activePage === "Clients") {
      return <ClientsPage title="Clients" subtitle="Companies receiving security services." rows={clients} loading={clientsLoading} error={clientsError} onRefresh={loadClients} />;
    }

    if (activePage === "Sites & Posts") {
      return <SitesPostsPage branches={branches} sites={sites} posts={posts} clients={clients} loading={locationsLoading} error={locationsError} onRefresh={loadLocations} onBranchesCreated={loadLocations} />;
    }

    if (activePage === "Deployments") {
      return <DeploymentsPage rows={deployments} guards={guards} posts={posts} loading={deploymentsLoading} error={deploymentsError} onRefresh={loadDeployments} />;
    }

    if (activePage === "Replacement History") {
      return <ReplacementHistoryPage />;
    }

    if (activePage === "Attendance") {
      return <AttendancePage rows={attendance} deployments={deployments} guards={guards} posts={posts} loading={attendanceLoading} error={attendanceError} onRefresh={loadAttendance} />;
    }

    if (activePage === "Leave Requests") {
      return <LeavePage rows={leaves} guards={guards} currentUser={user} loading={leavesLoading} error={leavesError} onRefresh={loadLeaves} />;
    }

    if (activePage === "Payroll") {
      return (
      <PayrollPage
        rows={payroll}
        guards={guards}
        loading={payrollLoading}
        error={payrollError}
        onRefresh={loadPayroll}
      />
    );
  }

    return <PlaceholderPage activePage={activePage} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        user={user}
        onLogout={onLogout}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="main-area">
        <Topbar
          activePage={activePage}
          user={user}
          onRefresh={refresh}
          loading={Boolean(loadingByPage[activePage])}
          setMobileOpen={setMobileOpen}
        />
        <main className="main-content">{renderPage()}</main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} SecureOps</span>
          <span><span className="status-dot" />Security workforce management</span>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [checkingSession, setCheckingSession] = useState(
    Boolean(sessionStorage.getItem("access_token"))
  );

  useEffect(() => {
    if (!sessionStorage.getItem("access_token")) {
      setCheckingSession(false);
      return;
    }

    apiRequest("/auth/me")
      .then((currentUser) => {
        setUser(currentUser);
        sessionStorage.setItem("user", JSON.stringify(currentUser));
      })
      .catch(() => {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");
    setUser(null);
  }, []);

  if (checkingSession) {
    return (
      <div className="app-loading-screen">
        <div className="loading-logo"><ShieldCheck size={29} /></div>
        <div className="loading-spinner" />
        <p>Loading SecureOps...</p>
      </div>
    );
  }

  return user ? <Dashboard user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}
