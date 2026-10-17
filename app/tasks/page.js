import { redirect } from "next/navigation";

// The Tasks page is now Plan (tasks and events); old links and bookmarks still work.
export default function TasksRedirect() {
  redirect("/plan");
}
