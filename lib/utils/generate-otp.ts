import { randomInt } from "crypto";

export function generateOTP(): string {
  // Use crypto.randomInt for cryptographically secure random numbers
  const randomNumber = randomInt(0, 1000000);
  const otp = randomNumber.toString().padStart(6, "0");
  return otp;
}
