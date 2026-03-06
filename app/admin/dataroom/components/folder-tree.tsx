"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import type { FiledDocument, FolderNode } from "./dataroom-types";

// ---------------------------------------------------------------------------
// Folder Tree — virtual folder navigation from orgVaultPath
// ---------------------------------------------------------------------------

interface FolderTreeProps {
  filings: FiledDocument[];
  selectedPath: string | null;
  onSelectPath: (path: string | null) => void;
}

/** Build a folder tree from filing paths */
function buildTree(filings: FiledDocument[]): FolderNode {
  const root: FolderNode = {
    name: "All Documents",
    path: "",
    children: [],
    fileCount: filings.length,
  };

  const pathMap = new Map<string, FolderNode>();
  pathMap.set("", root);

  for (const f of filings) {
    const vaultPath = f.orgVaultPath;
    if (!vaultPath) continue;

    // Extract folder path — everything before the last /
    const lastSlash = vaultPath.lastIndexOf("/");
    if (lastSlash <= 0) continue;
    const folderPath = vaultPath.substring(0, lastSlash);

    // Build each segment
    const segments = folderPath.split("/").filter(Boolean);
    let currentPath = "";
    let parentNode = root;

    for (const seg of segments) {
      currentPath += `/${seg}`;
      let node = pathMap.get(currentPath);
      if (!node) {
        node = {
          name: seg,
          path: currentPath,
          children: [],
          fileCount: 0,
        };
        pathMap.set(currentPath, node);
        parentNode.children.push(node);
      }
      node.fileCount++;
      parentNode = node;
    }
  }

  // Sort children by name
  const sortChildren = (node: FolderNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of node.children) sortChildren(child);
  };
  sortChildren(root);

  return root;
}

function FolderItem({
  node,
  depth,
  selectedPath,
  onSelectPath,
}: {
  node: FolderNode;
  depth: number;
  selectedPath: string | null;
  onSelectPath: (path: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected =
    selectedPath === node.path || (selectedPath === null && node.path === "");
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          onSelectPath(node.path === "" ? null : node.path);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors ${
          isSelected
            ? "bg-blue-600/10 text-blue-600 dark:text-blue-400"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        {isSelected ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0 text-blue-500" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{node.name}</span>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">
          {node.fileCount}
        </span>
      </button>
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <FolderItem
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
          />
        ))}
    </div>
  );
}

export function FolderTree({
  filings,
  selectedPath,
  onSelectPath,
}: FolderTreeProps) {
  const tree = useMemo(() => buildTree(filings), [filings]);

  return (
    <div className="space-y-0.5">
      <FolderItem
        node={tree}
        depth={0}
        selectedPath={selectedPath}
        onSelectPath={onSelectPath}
      />
    </div>
  );
}
