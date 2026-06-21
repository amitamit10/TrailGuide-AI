"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, Calendar, Map, Upload, Compass, Sparkles, ScrollText, Receipt, Backpack } from "lucide-react";

const TABS = [
  { label: "Dashboard", href: "dashboard", icon: LayoutDashboard },
  { label: "Timeline",  href: "timeline",  icon: List            },
  { label: "Companion", href: "companion", icon: Sparkles        },
  { label: "Discover",  href: "discover",  icon: Compass         },
  { label: "Summary",   href: "summary",   icon: ScrollText      },
  { label: "Expenses",  href: "expenses",  icon: Receipt         },
  { label: "Pack",      href: "pack",      icon: Backpack        },
  { label: "Calendar",  href: "calendar",  icon: Calendar        },
  { label: "Map",       href: "map",       icon: Map             },
  { label: "Import",    href: "import",    icon: Upload          },
];

export function TripTabNav({ tripId }: { tripId: string }) {
  const pathname = usePathname();

  return (
    <div className="flex overflow-x-auto no-scrollbar border-t border-border/40 max-w-3xl mx-auto w-full">
      {TABS.map((tab) => {
        const href = `/trips/${tripId}/${tab.href}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={href}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
