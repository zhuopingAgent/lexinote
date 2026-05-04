"use client";

import Link from "next/link";
import { AppBrandIcon } from "@/app/components/icons";
import { ThemeToggle } from "@/app/components/theme-toggle";

type NavItem = {
  active?: boolean;
  label: string;
};

type AppHeaderProps = {
  brandHref?: string;
  navItems: NavItem[];
};

export function AppHeader({ brandHref = "/", navItems }: AppHeaderProps) {
  return (
    <header className="app-header border-b border-black/50 bg-[#1e1e1ecc]">
      <div className="app-header__inner mr-auto flex h-[clamp(56px,6vw,60px)] w-full max-w-[1160px] items-center gap-[clamp(24px,5vw,48px)] pl-[clamp(16px,4vw,32px)] pr-[clamp(16px,3vw,24px)]">
        <Link href={brandHref} className="app-brand flex items-center gap-2.5">
          <AppBrandIcon className="size-[clamp(22px,2.5vw,24px)] text-accent" />
          <p className="app-brand__title text-[clamp(17px,2.3vw,20px)] font-medium tracking-[-0.03em] text-white/70">
            LexiNote
          </p>
        </Link>

        <nav
          className="app-header__nav flex items-center gap-[clamp(12px,2.4vw,24px)] whitespace-nowrap"
          aria-label="Primary"
        >
          {navItems.map((item) => (
            <span
              key={item.label}
              className={
                item.active
                  ? "text-[clamp(13px,1.8vw,16px)] text-white/60"
                  : "text-[clamp(13px,1.8vw,16px)] text-white/45"
              }
            >
              {item.label}
            </span>
          ))}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
