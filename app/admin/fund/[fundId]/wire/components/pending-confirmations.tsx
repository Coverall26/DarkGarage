"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Loader2,
  Clock,
  DollarSign,
  FileText,
  Building2,
  XCircle,
  Upload,
} from "lucide-react";
import type { PendingTransaction, ConfirmForm } from "./types";
import { formatCurrency, formatDate, STATUS_STYLES } from "./types";

interface PendingConfirmationsProps {
  transactions: PendingTransaction[];
  loading: boolean;
  confirmingId: string | null;
  confirmForm: ConfirmForm;
  confirmLoading: boolean;
  bankStatementUploading: boolean;
  bankStatementRef: React.RefObject<HTMLInputElement | null>;
  onConfirmFormChange: (field: keyof ConfirmForm, value: string) => void;
  onConfirmCheckedChange: (checked: boolean) => void;
  onBankStatementUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartConfirm: (tx: PendingTransaction) => void;
  onCancelConfirm: () => void;
  onConfirm: (transactionId: string) => void;
  onRefresh: () => void;
}

export function PendingConfirmations({
  transactions,
  loading,
  confirmingId,
  confirmForm,
  confirmLoading,
  bankStatementUploading,
  bankStatementRef,
  onConfirmFormChange,
  onConfirmCheckedChange,
  onBankStatementUpload,
  onStartConfirm,
  onCancelConfirm,
  onConfirm,
  onRefresh,
}: PendingConfirmationsProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-400 mb-4" />
          <h3 className="text-lg font-medium">No pending wire transfers</h3>
          <p className="text-sm text-muted-foreground mt-1">
            All incoming wire transfers have been confirmed. New pending
            transactions will appear here.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {transactions.length} pending transaction
          {transactions.length !== 1 ? "s" : ""} awaiting confirmation
        </p>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      {transactions.map((tx) => (
        <Card key={tx.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {tx.investorName}
              </CardTitle>
              <Badge className={STATUS_STYLES[tx.status] || "bg-gray-100 text-gray-800"}>
                {tx.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Fund</p>
                <p className="font-medium">{tx.fundName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  {formatCurrency(tx.amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">{tx.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Initiated</p>
                <p className="text-sm flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {formatDate(tx.initiatedAt)}
                </p>
              </div>
            </div>

            {tx.description && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {tx.description}
                </p>
              </div>
            )}

            {confirmingId === tx.id ? (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <h4 className="font-medium text-sm">Confirm Wire Receipt</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`date-${tx.id}`}>
                      Funds Received Date{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={`date-${tx.id}`}
                      type="date"
                      value={confirmForm.fundsReceivedDate}
                      onChange={(e) =>
                        onConfirmFormChange("fundsReceivedDate", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`amount-${tx.id}`}>
                      Amount Received ($){" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={`amount-${tx.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={confirmForm.amountReceived}
                      onChange={(e) =>
                        onConfirmFormChange("amountReceived", e.target.value)
                      }
                    />
                    {confirmForm.amountReceived &&
                      parseFloat(confirmForm.amountReceived) !== tx.amount && (
                        <p className="text-xs text-amber-600 mt-1">
                          Variance:{" "}
                          {formatCurrency(
                            parseFloat(confirmForm.amountReceived) - tx.amount,
                          )}{" "}
                          from expected {formatCurrency(tx.amount)}
                        </p>
                      )}
                  </div>
                </div>

                <div>
                  <Label htmlFor={`ref-${tx.id}`}>
                    Bank Reference / Transaction ID
                  </Label>
                  <Input
                    id={`ref-${tx.id}`}
                    placeholder="e.g., FWT-20260210-001234"
                    value={confirmForm.bankReference}
                    onChange={(e) =>
                      onConfirmFormChange("bankReference", e.target.value)
                    }
                  />
                </div>

                <div>
                  <Label htmlFor={`notes-${tx.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${tx.id}`}
                    placeholder="Optional notes about this confirmation..."
                    value={confirmForm.confirmationNotes}
                    onChange={(e) =>
                      onConfirmFormChange("confirmationNotes", e.target.value)
                    }
                    rows={2}
                  />
                </div>

                {/* Optional: Upload bank statement as additional proof */}
                <div>
                  <Label className="text-sm">
                    Bank Statement (optional)
                  </Label>
                  <div className="mt-1">
                    {confirmForm.bankStatementFileName ? (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{confirmForm.bankStatementFileName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 ml-auto"
                          onClick={() =>
                            onConfirmFormChange("bankStatementFileName", "")
                          }
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={bankStatementUploading}
                        onClick={() => bankStatementRef.current?.click()}
                      >
                        {bankStatementUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {bankStatementUploading
                          ? "Uploading..."
                          : "Upload PDF"}
                      </Button>
                    )}
                    <input
                      ref={bankStatementRef}
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      onChange={onBankStatementUpload}
                    />
                  </div>
                </div>

                {/* Confirmation checkbox */}
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900/30">
                  <Checkbox
                    id={`confirm-check-${tx.id}`}
                    checked={confirmForm.confirmed}
                    onCheckedChange={(checked) =>
                      onConfirmCheckedChange(checked === true)
                    }
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`confirm-check-${tx.id}`}
                    className="text-sm leading-tight cursor-pointer"
                  >
                    I confirm these funds have been received in the fund
                    account.
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => onConfirm(tx.id)}
                    disabled={confirmLoading || !confirmForm.confirmed}
                  >
                    {confirmLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Confirming...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirm Receipt
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancelConfirm}
                    disabled={confirmLoading}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onStartConfirm(tx)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm Wire Receipt
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
