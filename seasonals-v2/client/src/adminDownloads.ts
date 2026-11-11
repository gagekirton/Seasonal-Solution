function authHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("app-session-token");
    const cookie = raw
      ?.split(";")
      .map(part => part.trim())
      .find(part => part.startsWith("webdev_app_session="));
    const token = cookie?.slice("webdev_app_session=".length);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function downloadPrivateCsv(
  path: string,
  filename: string
): Promise<void> {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      body.error || "The private export could not be downloaded."
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
