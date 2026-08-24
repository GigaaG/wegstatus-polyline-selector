export interface ClipboardEnvironment {
  navigator: {
    clipboard?: {
      writeText: (text: string) => Promise<void>;
    };
  };
  document: Document;
}

export async function copyText(
  text: string,
  environment: ClipboardEnvironment = { navigator, document },
): Promise<void> {
  try {
    if (environment.navigator.clipboard?.writeText) {
      await environment.navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall back to execCommand below. Clipboard access can be denied per browser policy.
  }

  const textarea = environment.document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  environment.document.body.append(textarea);
  textarea.select();

  const copied = environment.document.execCommand?.("copy") ?? false;
  textarea.remove();

  if (!copied) {
    throw new Error("De polyline kon niet naar het klembord worden gekopieerd.");
  }
}
