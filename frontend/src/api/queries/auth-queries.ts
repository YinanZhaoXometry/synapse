/**
 * Auth query + mutation hooks (epic P2-8 T2, AD-15; the me read lands with
 * epic-25 T3): the Login/Register pairs return the session JWT + the
 * account; the caller (the wall pages) persists the token via the apollo
 * seam. No cache sweeps: these fire before any domain query exists under
 * the new identity. `useMeQuery` is the session identity read — the chrome
 * derives its display name + avatar letter from the email (see
 * components/shared/session-identity, the one derivation every identity
 * render site shares).
 */
import { useMutation, useQuery } from "@apollo/client/react";
import { LoginDocument, MeDocument, RegisterDocument } from "@/types/graphql";

export function useLoginMutation() {
  return useMutation(LoginDocument);
}

export function useRegisterMutation() {
  return useMutation(RegisterDocument);
}

export function useMeQuery() {
  const result = useQuery(MeDocument);
  const email = result.data?.me.email;
  return { data: result.data !== undefined ? email : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}
