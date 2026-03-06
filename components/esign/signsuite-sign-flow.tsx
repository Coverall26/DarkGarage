/**
 * signsuite-sign-flow.tsx — SignSuite brand alias for the multi-document signing flow.
 *
 * Re-exports FundRoomSignFlow (the production component) under the v3 brand name.
 * New code should import from this file. The FundRoomSignFlow.tsx file is kept for
 * backward compatibility with existing imports.
 *
 * @example
 *   import { SignSuiteSignFlow } from "@/components/esign/signsuite-sign-flow";
 *   // or
 *   import SignSuiteSignFlow from "@/components/esign/signsuite-sign-flow";
 */

// Re-export the component under the v3 brand name
export { default as SignSuiteSignFlow, default } from "./FundRoomSignFlow";
