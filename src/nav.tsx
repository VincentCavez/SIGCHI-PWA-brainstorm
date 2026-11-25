// Navigation interne du prototype (pas de routeur : une page courante + quelques paramètres).
import { createContext, useContext } from "react";
import type { Page } from "./components/Sidebar";
import type { Id } from "./api/types";

export type NavParams = { personId?: Id; affiliation?: string; query?: string; floorId?: Id };
export type Nav = { page: Page; params: NavParams; go: (page: Page, params?: NavParams) => void };

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const v = useContext(NavContext);
  if (!v) throw new Error("useNav outside NavContext");
  return v;
}
