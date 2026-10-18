"use client";

import { useState } from "react";
import AddBar from "./AddBar";
import Icon from "./Icon";
import Modal from "./Modal";

// The one place to add a task or an event, the same on Today and Plan: the
// Add bar on wide screens; on phones, a floating + that opens it in a sheet.
// Props go to AddBar (goals, addTask, addEvent, defaultDueDate).
export default function AddAnything(props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <>
      <div className="addbar-inline">
        <AddBar {...props} />
      </div>
      <button type="button" className="fab" onClick={() => setSheetOpen(true)} aria-label="Add a task or event">
        <Icon name="plus" size={24} />
      </button>
      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title="Add">
        <AddBar {...props} inSheet onAdded={() => setSheetOpen(false)} />
      </Modal>
    </>
  );
}
