import React from "react";
import { createRoot } from "react-dom/client";
import { ArchiveOcellusApp } from "./ArchiveOcellusApp";
import { practiceEntry } from "./practiceEntry";

const entry = practiceEntry(new URL(window.location.href));
if (entry.href !== window.location.href) history.replaceState(history.state, "", entry);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(React.createElement(ArchiveOcellusApp));
