"use client";

import Select from "../components/Select";
import Popover from "../components/Popover";
import Icon from "../components/Icon";

export const NO_FILTERS = { category: "All", status: "All", priority: "All", effort: "All" };

const FILTER_FIELDS = [
  { key: "category", label: "Category", all: "All categories", options: ["General Life", "Goal-Related"] },
  { key: "status", label: "Status", all: "All statuses", options: ["To Do", "Done"] },
  { key: "priority", label: "Priority", all: "All priorities", options: ["High", "Medium", "Low"] },
  { key: "effort", label: "Effort", all: "All effort", options: ["Small", "Medium", "Large"] },
];

const SORT_OPTIONS = [
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "effort", label: "Effort" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "custom", label: "Custom (drag to reorder)" },
];

export function activeFilterCount(filters) {
  return Object.values(filters).filter((v) => v !== "All").length;
}

// Filters (in a popover), sort (list view only) and the list / calendar switch.
export default function FilterBar({ filters, onFiltersChange, sortBy, onSortChange, view, onViewChange }) {
  const count = activeFilterCount(filters);
  const setFilter = (key, value) => onFiltersChange({ ...filters, [key]: value });
  const clearAll = () => onFiltersChange(NO_FILTERS);

  return (
    <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <Popover
          label={
            <>
              Filters
              {count > 0 && <span className="filter-count">{count}</span>}
            </>
          }
          onClear={count > 0 ? clearAll : undefined}
          clearLabel="Clear all filters"
        >
          <div className="filter-panel">
            {FILTER_FIELDS.map((f) => (
              <div className="filter-panel-row" key={f.key}>
                <label>{f.label}</label>
                <Select
                  ariaLabel={`Filter by ${f.key}`}
                  value={filters[f.key]}
                  onChange={(value) => setFilter(f.key, value)}
                  options={[{ value: "All", label: f.all }, ...f.options]}
                  onClear={filters[f.key] !== "All" ? () => setFilter(f.key, "All") : undefined}
                  clearLabel={`Clear ${f.key} filter`}
                />
              </div>
            ))}
            {count > 0 && (
              <button className="ghost filter-panel-clear" onClick={clearAll}>Clear all filters</button>
            )}
          </div>
        </Popover>

        {view === "list" && (
          <div className="sort-control">
            <span className="sort-label">Sort</span>
            <Select
              ariaLabel="Sort tasks"
              value={sortBy}
              onChange={onSortChange}
              options={SORT_OPTIONS}
              onClear={sortBy !== "due" ? () => onSortChange("due") : undefined}
              clearLabel="Clear sort"
            />
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 4 }}>
        <button
          className={`ghost view-toggle-btn ${view === "list" ? "active" : ""}`}
          onClick={() => onViewChange("list")}
          aria-label="List view"
        >
          <Icon name="list" size={15} />
        </button>
        <button
          className={`ghost view-toggle-btn ${view === "calendar" ? "active" : ""}`}
          onClick={() => onViewChange("calendar")}
          aria-label="Calendar view"
        >
          <Icon name="calendar" size={15} />
        </button>
      </div>
    </div>
  );
}
