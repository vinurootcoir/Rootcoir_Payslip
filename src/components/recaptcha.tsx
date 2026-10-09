"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

function removeRecaptchaBadge() {
  document.querySelectorAll(".grecaptcha-badge").forEach((node) => {
    node.parentElement?.remove();
  });
}

export function RecaptchaScript({ siteKey }: { siteKey: string | null }) {
  useEffect(() => {
    if (!siteKey) return;

    let script = document.querySelector<HTMLScriptElement>('script[data-recaptcha="v3"]');
    if (!script) {
      script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.dataset.recaptcha = "v3";
      document.head.appendChild(script);
    }

    // Badge is only for open auth forms. Remove it when leaving those pages
    // so it does not linger on the portal after client-side navigation.
    return () => {
      removeRecaptchaBadge();
    };
  }, [siteKey]);

  return null;
}

export function RecaptchaNotice() {
  return (
    <p className="text-[11px] leading-snug text-faint">
      This site is protected by reCAPTCHA and the Google{" "}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-muted"
      >
        Privacy Policy
      </a>{" "}
      and{" "}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-muted"
      >
        Terms of Service
      </a>{" "}
      apply.
    </p>
  );
}

export async function executeRecaptcha(
  siteKey: string | null,
  action: string,
): Promise<string> {
  if (!siteKey) return "";
  if (typeof window === "undefined" || !window.grecaptcha) {
    throw new Error("Security check is still loading. Wait a moment and try again.");
  }
  await new Promise<void>((resolve) => {
    window.grecaptcha!.ready(() => resolve());
  });
  return window.grecaptcha.execute(siteKey, { action });
}
