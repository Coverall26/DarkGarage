"use client";

import { ComponentProps } from "react";

import { PermissionsSheet as PermissionsSheetEE } from "@/ee/features/permissions/components/permissions-sheet";

export function PermissionsSheet(props: ComponentProps<typeof PermissionsSheetEE>) {
  return <PermissionsSheetEE {...props} />;
}
