"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CurrencyInput({
  label,
  required,
  placeholder,
  value,
  onChange,
  helper,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  helper?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          $
        </span>
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            onChange(raw ? Number(raw).toLocaleString("en-US") : "");
          }}
          className="pl-7 text-base sm:text-sm"
        />
      </div>
      {helper && <p className="text-xs text-gray-500">{helper}</p>}
    </div>
  );
}

export function PctInput({
  label,
  required,
  placeholder,
  value,
  onChange,
  helper,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  helper?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-8 text-base sm:text-sm"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          %
        </span>
      </div>
      {helper && <p className="text-xs text-gray-500">{helper}</p>}
    </div>
  );
}
