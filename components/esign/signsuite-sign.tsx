/**
 * signsuite-sign.tsx — SignSuite brand alias for the e-signature signing component.
 *
 * Re-exports FundRoomSign (the production component) under the v3 brand name.
 * New code should import from this file. The FundRoomSign.tsx file is kept for
 * backward compatibility with existing imports.
 *
 * @example
 *   import { SignSuiteSign } from "@/components/esign/signsuite-sign";
 *   // or
 *   import SignSuiteSign from "@/components/esign/signsuite-sign";
 */

// Re-export the component under the v3 brand name
export { default as SignSuiteSign, default } from "./FundRoomSign";

// Re-export all types
export type {
  SignatureField,
  InvestorAutoFillData,
  SigningDocument,
} from "./fundroom-sign-types";
