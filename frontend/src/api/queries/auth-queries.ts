/**
 * Auth mutation hooks (epic P2-8 T2, AD-15): the wall's only api touches —
 * the Login/Register pairs return the session JWT + the account; the caller
 * (the wall pages) persists the token via the apollo seam. No cache sweeps:
 * these fire before any domain query exists under the new identity.
 */
import { useMutation } from "@apollo/client/react";
import { LoginDocument, RegisterDocument } from "@/types/graphql";

export function useLoginMutation() {
  return useMutation(LoginDocument);
}

export function useRegisterMutation() {
  return useMutation(RegisterDocument);
}
