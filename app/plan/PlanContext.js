"use client";

import { createContext, useContext } from "react";

// Shared by the Plan page's pieces: everything from usePlanData, plus
// openTask(task), openEvent(event) and newEventOn(date) for the dialogs.
export const PlanContext = createContext(null);

export function usePlan() {
  return useContext(PlanContext);
}
