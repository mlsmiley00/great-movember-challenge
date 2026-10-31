import Link from "next/link";
import {
  Home,
  Target,
  PlusCircle,
  Trophy,
  Users,
  MessagesSquare,
  Shield,
  LogOut,
} from "lucide-react";
import { member } from "@/lib/auth";
import { translations } from "@/lib/i18n";
import { Language, Mustache } from "../ui";
import { signOut } from "../actions";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { membership } = await member();
  const t = await translations();
  const links = [
    ["/", t.home, Home],
    ["/goals", t.goals, Target],
    ["/log", t.log, PlusCircle],
    ["/leaderboard", t.leaderboard, Trophy],
    ["/teams", t.teams, Users],
    ["/community", t.community, MessagesSquare],
  ] as const;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="wordmark">
          <Mustache />
          <span>
            THE GREAT
            <br />
            <strong>MOVEMBER</strong>
            <br />
            <small>CHALLENGE · 2026</small>
          </span>
        </Link>
        <div className="barber-stripe" />
        <p className="sidebar-label">THE MEMBERS’ CLUB</p>
        <nav>
          {links.map(([href, label, Icon]) => (
            <Link href={href} key={href}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
          {membership.role === "admin" && (
            <Link href="/admin">
              <Shield size={18} />
              {t.admin}
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="member-stamp">
            ✦
            <span>
              {t.dates}
              <small>{t.private}</small>
            </span>
          </div>
          <form action={signOut}>
            <button className="text-button">
              <LogOut size={16} />
              {t.logout}
            </button>
          </form>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Link href="/" className="mobile-brand">
            <Mustache />
            MOVEMBER ’26
          </Link>
          <span className="club-status">
            <i />
            {t.private}
          </span>
          <div className="topbar-right">
            <Language />
            <span className="avatar">
              {membership.display_name.slice(0, 1).toUpperCase()}
            </span>
            <span className="username">{membership.display_name}</span>
          </div>
        </header>
        <div className="content">
          {children}
          <footer className="site-footer">
            <Mustache />
            <span>
              GOOD HABITS. GREAT COMPANY. <b>2026</b>
            </span>
          </footer>
        </div>
        <nav className="mobile-nav">
          {links.slice(0, 5).map(([href, label, Icon]) => (
            <Link key={href} href={href}>
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
          <Link href="/community">
            <MessagesSquare size={20} />
            <span>{t.community}</span>
          </Link>
        </nav>
        <div className="mobile-account">
          <form action={signOut}>
            <button className="text-button">{t.logout}</button>
          </form>
          {membership.role === "admin" && <Link href="/admin">{t.admin}</Link>}
        </div>
      </div>
    </div>
  );
}
