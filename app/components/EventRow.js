"use client";

import Icon from "./Icon";
import { openOnKey, openOnRowClick } from "../../lib/rowClick";
import { repeatLabel } from "../../lib/events";
import { useSwipeRow } from "../../lib/useSwipeRow";

// An event in a list of tasks: shaped like a task row so they line up, but
// with a teal clock where the checkbox would be. Click the row to open it;
// × (on hover) or a swipe left deletes it.
export default function EventRow({ event, when, past = false, onOpen, onDelete }) {
  // Touch screens: swipe left to delete.
  const swipe = useSwipeRow({ onLeft: onDelete });
  return (
    <div className={`task-row list-event clickable-row ${past ? "past" : ""}`} onClick={openOnRowClick(onOpen)} {...swipe}>
      <span className="list-event-icon">
        <Icon name="clock" size={14} />
      </span>
      <span className="task-main">
        <span className="task-name" role="button" tabIndex={0} onKeyDown={openOnKey(onOpen)}>
          {event.title}
        </span>
        <span className="task-meta">
          <span className="meta-item list-event-when">{when}</span>
          {event.location && <span className="meta-item">{event.location}</span>}
          {event.recurrence_unit && (
            <span className="meta-item" title="Repeats">
              <Icon name="repeat" size={12} />
              {repeatLabel(event)}
            </span>
          )}
        </span>
      </span>
      <div className="task-actions">
        <button className="ghost icon-btn" onClick={onDelete} aria-label="Delete event" title="Delete">
          ×
        </button>
      </div>
    </div>
  );
}
