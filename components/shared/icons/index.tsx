"use client";

import { ComponentType, SVGProps } from "react";

import { LucideIcon } from "lucide-react";

export type Icon = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;

// Barrel exports for all custom SVG icons
// Import from "@/components/shared/icons" instead of individual files
export { default as AdvancedSheet } from "./advanced-sheet";
export { default as BarChart } from "./bar-chart";
export { default as Check } from "./check";
export { default as ChevronDown } from "./chevron-down";
export { default as ChevronRight } from "./chevron-right";
export { default as ChevronUp } from "./chevron-up";
export { default as Circle } from "./circle";
export { default as CloudDownloadOff } from "./cloud-download-off";
export { default as Copy } from "./copy";
export { default as Eye } from "./eye";
export { default as EyeOff } from "./eye-off";
export { Facebook } from "./facebook";
export { default as FileUp } from "./file-up";
export { default as Folder } from "./folder";
export { default as FundroomSparkle } from "./fundroom-sparkle";
export { default as Github } from "./github";
export { default as Google } from "./google";
export { default as GripVertical } from "./grip-vertical";
export { default as Home } from "./home";
export { default as LinkedIn } from "./linkedin";
export { default as Menu } from "./menu";
export { default as Moon } from "./moon";
export { default as MoreHorizontal } from "./more-horizontal";
export { default as MoreVertical } from "./more-vertical";
export { default as Passkey } from "./passkey";
export { default as PortraitLandscape } from "./portrait-landscape";
export { default as Search } from "./search";
export { default as Settings } from "./settings";
export { default as Sparkle } from "./sparkle";
export { default as Sun } from "./sun";
export { default as Teams } from "./teams";
export { default as Twitter } from "./twitter";
export { default as UserRound } from "./user-round";
export { default as X } from "./x";
