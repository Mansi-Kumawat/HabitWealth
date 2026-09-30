/**
 * API CLIENT (browser side)
 * =========================
 * Central axios instance so every page calls the backend the same way.
 * `withCredentials` sends our httpOnly session cookie along automatically.
 * The helper `api.get/post/put/del` unwraps the server's standard
 * { success, message, data } envelope and turns failures into thrown errors
 * with the server's friendly message attached.
 */
"use client";

import axios, { AxiosError } from "axios";

const http = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/** The shape every one of our API routes returns. */
interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** An error that carries the server's friendly message. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Unwrap the envelope or throw an ApiError with the server's message. */
function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  return promise
    .then((response) => response.data.data)
    .catch((error: AxiosError<ApiEnvelope<T>>) => {
      const message =
        error.response?.data?.message ??
        "Network problem - please check your connection and retry.";
      throw new ApiError(message, error.response?.status ?? 0);
    });
}

export const api = {
  get: <T = unknown>(url: string) => unwrap<T>(http.get(url)),
  post: <T = unknown>(url: string, body?: unknown) => unwrap<T>(http.post(url, body)),
  put: <T = unknown>(url: string, body?: unknown) => unwrap<T>(http.put(url, body)),
  del: <T = unknown>(url: string) => unwrap<T>(http.delete(url)),
};
