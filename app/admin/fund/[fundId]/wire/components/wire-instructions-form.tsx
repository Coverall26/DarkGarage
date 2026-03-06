"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Banknote,
  CheckCircle2,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import type { WireInstructions } from "./types";

interface WireInstructionsFormProps {
  form: WireInstructions;
  configured: boolean;
  saving: boolean;
  saved: boolean;
  onUpdateField: (field: keyof WireInstructions, value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}

export function WireInstructionsForm({
  form,
  configured,
  saving,
  saved,
  onUpdateField,
  onSave,
  onDelete,
}: WireInstructionsFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Bank Details</CardTitle>
        </div>
        <CardDescription>
          These details will be shown to investors when they need to send wire
          transfers. The account number will be masked for investor display.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bankName">
              Bank Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="bankName"
              placeholder="e.g., JPMorgan Chase"
              value={form.bankName}
              onChange={(e) => onUpdateField("bankName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="beneficiaryName">
              Beneficiary Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="beneficiaryName"
              placeholder="e.g., Acme Growth Fund I LLC"
              value={form.beneficiaryName}
              onChange={(e) => onUpdateField("beneficiaryName", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="routingNumber">
              Routing Number (ABA) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="routingNumber"
              placeholder="e.g., 021000021"
              value={form.routingNumber}
              onChange={(e) => onUpdateField("routingNumber", e.target.value)}
              maxLength={9}
            />
          </div>
          <div>
            <Label htmlFor="accountNumber">
              Account Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="accountNumber"
              placeholder="e.g., 1234567890"
              value={form.accountNumber}
              onChange={(e) => onUpdateField("accountNumber", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="swiftCode">SWIFT Code (international)</Label>
            <Input
              id="swiftCode"
              placeholder="e.g., CHASUS33"
              value={form.swiftCode || ""}
              onChange={(e) => onUpdateField("swiftCode", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="beneficiaryAddress">Beneficiary Address</Label>
            <Input
              id="beneficiaryAddress"
              placeholder="e.g., 123 Main St, New York, NY"
              value={form.beneficiaryAddress || ""}
              onChange={(e) =>
                onUpdateField("beneficiaryAddress", e.target.value)
              }
            />
          </div>
        </div>

        <div>
          <Label htmlFor="reference">Default Reference / Memo</Label>
          <Input
            id="reference"
            placeholder='e.g., "Investor Name - Fund Name"'
            value={form.reference || ""}
            onChange={(e) => onUpdateField("reference", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Suggested reference line investors should include in their wire
          </p>
        </div>

        <div>
          <Label htmlFor="notes">Special Instructions</Label>
          <Textarea
            id="notes"
            placeholder="Any additional instructions for investors..."
            value={form.notes || ""}
            onChange={(e) => onUpdateField("notes", e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {configured && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={saving}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Wire Instructions"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
